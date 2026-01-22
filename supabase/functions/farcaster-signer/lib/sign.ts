/**
 * Signing and Hub submission utilities for the Farcaster Signing Service
 *
 * Uses @farcaster/core directly with data_bytes approach to ensure
 * compatible protobuf serialization with Farcaster Hubs (works in Deno).
 */

import {
  makeCastAdd,
  makeCastRemove,
  makeReactionAdd,
  makeReactionRemove,
  makeLinkAdd,
  makeLinkRemove,
  Message,
  MessageData,
  NobleEd25519Signer,
  FarcasterNetwork,
  ReactionType,
  hexStringToBytes,
} from 'npm:@farcaster/core@0.14.19';
import { HubSubmissionFailedError } from './errors.ts';

// ============================================================================
// Hub Endpoints
// ============================================================================

/**
 * Hub endpoints to try in order of preference
 */
const HUB_ENDPOINTS = [
  'https://snapchain-api.neynar.com',
  'https://hub-api.neynar.com',
  'https://hub.pinata.cloud',
];

// ============================================================================
// Types
// ============================================================================

export interface CastParams {
  fid: number;
  privateKey: string;
  text: string;
  parentUrl?: string;
  parentCastId?: {
    fid: number;
    hash: string;
  };
  embeds?: Array<{ url: string } | { castId: { fid: number; hash: string } }>;
}

export interface ReactionParams {
  fid: number;
  privateKey: string;
  type: 'like' | 'recast';
  targetFid: number;
  targetHash: string;
}

export interface FollowParams {
  fid: number;
  privateKey: string;
  targetFid: number;
}

export interface RemoveCastParams {
  fid: number;
  privateKey: string;
  castHash: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Create a signer from a hex private key
 */
function createSigner(privateKey: string): NobleEd25519Signer {
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  // Validate the key is 64 hex characters
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new HubSubmissionFailedError('Invalid private key format', {
      reason: 'Private key must be 64 hex characters',
    });
  }

  const keyBytes = hexToBytes(cleanKey);
  return new NobleEd25519Signer(keyBytes);
}

/**
 * Submit a message to the Hub using data_bytes approach
 * This bypasses Deno's protobuf serialization issues
 */
async function submitMessageToHub(message: Message, hubUrl: string): Promise<{ hash: string }> {
  // CRITICAL: Use data_bytes to bypass protobuf serialization differences
  // The Hub will use our pre-serialized bytes for hash verification
  const dataBytes = MessageData.encode(message.data!).finish();

  // Include both data and dataBytes - Hub should prefer dataBytes for hash verification
  // when present, which bypasses re-serialization issues
  const messageWithDataBytes: Message = {
    data: message.data,
    hash: message.hash,
    hashScheme: message.hashScheme,
    signature: message.signature,
    signatureScheme: message.signatureScheme,
    signer: message.signer,
    dataBytes: dataBytes,
  };

  // Encode message to bytes
  const messageBytes = Message.encode(messageWithDataBytes).finish();

  // Use native fetch for binary data - more reliable in Deno than axios
  const response = await fetch(`${hubUrl}/v1/submitMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'api_key': Deno.env.get('NEYNAR_API_KEY') || '',
    },
    body: messageBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    throw new Error(errorData.errCode || errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Cast Operations
// ============================================================================

/**
 * Sign and submit a cast to the Farcaster network
 * Tries multiple Hub endpoints until one succeeds
 */
export async function signAndSubmitCast(params: CastParams): Promise<string> {
  const { fid, privateKey, text, parentUrl, parentCastId, embeds } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  // Build the cast body
  const castAddBody: {
    text: string;
    mentions: number[];
    mentionsPositions: number[];
    embeds: Array<{ url?: string; castId?: { fid: number; hash: Uint8Array } }>;
    embedsDeprecated: string[];
    parentUrl?: string;
    parentCastId?: { fid: number; hash: Uint8Array };
  } = {
    text,
    mentions: [],
    mentionsPositions: [],
    embeds: [],
    embedsDeprecated: [],
  };

  // Process embeds
  if (embeds) {
    for (const embed of embeds) {
      if ('url' in embed) {
        castAddBody.embeds.push({ url: embed.url });
      } else if ('castId' in embed) {
        const hashResult = hexStringToBytes(embed.castId.hash);
        if (hashResult.isOk()) {
          castAddBody.embeds.push({
            castId: {
              fid: embed.castId.fid,
              hash: hashResult.value,
            },
          });
        }
      }
    }
  }

  // Add parent URL if provided
  if (parentUrl) {
    castAddBody.parentUrl = parentUrl;
  }

  // Add parent cast ID if provided
  if (parentCastId) {
    const hashResult = hexStringToBytes(parentCastId.hash);
    if (hashResult.isOk()) {
      castAddBody.parentCastId = {
        fid: parentCastId.fid,
        hash: hashResult.value,
      };
    }
  }

  // Create the signed message
  const msgResult = await makeCastAdd(castAddBody, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create cast message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[signAndSubmitCast] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[signAndSubmitCast] Success with hub: ${hubUrl}, hash: ${result.hash}`);
      return result.hash;
    } catch (error) {
      console.log(`[signAndSubmitCast] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.response?.data?.message || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to submit cast to all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}

/**
 * Remove a cast from the Farcaster network
 */
export async function removeCast(params: RemoveCastParams): Promise<string> {
  const { fid, privateKey, castHash } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  const hashResult = hexStringToBytes(castHash);
  if (hashResult.isErr()) {
    throw new HubSubmissionFailedError(`Invalid cast hash: ${hashResult.error.message}`, {
      error: hashResult.error,
    });
  }

  const msgResult = await makeCastRemove({ targetHash: hashResult.value }, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create remove message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[removeCast] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[removeCast] Success with hub: ${hubUrl}, hash: ${result?.hash}`);
      return result?.hash ?? castHash;
    } catch (error) {
      console.log(`[removeCast] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to remove cast from all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}

// ============================================================================
// Reaction Operations
// ============================================================================

/**
 * Sign and submit a reaction (like or recast) to the Farcaster network
 */
export async function signAndSubmitReaction(params: ReactionParams): Promise<string> {
  const { fid, privateKey, type, targetFid, targetHash } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  const hashResult = hexStringToBytes(targetHash);
  if (hashResult.isErr()) {
    throw new HubSubmissionFailedError(`Invalid target hash: ${hashResult.error.message}`, {
      error: hashResult.error,
    });
  }

  const reactionBody = {
    type: type === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
    targetCastId: {
      fid: targetFid,
      hash: hashResult.value,
    },
  };

  const msgResult = await makeReactionAdd(reactionBody, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create reaction message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[signAndSubmitReaction] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[signAndSubmitReaction] Success with hub: ${hubUrl}, hash: ${result?.hash}`);
      return result?.hash ?? targetHash;
    } catch (error) {
      console.log(`[signAndSubmitReaction] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to submit reaction to all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}

/**
 * Remove a reaction (like or recast) from the Farcaster network
 */
export async function removeReaction(params: ReactionParams): Promise<string> {
  const { fid, privateKey, type, targetFid, targetHash } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  const hashResult = hexStringToBytes(targetHash);
  if (hashResult.isErr()) {
    throw new HubSubmissionFailedError(`Invalid target hash: ${hashResult.error.message}`, {
      error: hashResult.error,
    });
  }

  const reactionBody = {
    type: type === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
    targetCastId: {
      fid: targetFid,
      hash: hashResult.value,
    },
  };

  const msgResult = await makeReactionRemove(reactionBody, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create reaction remove message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[removeReaction] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[removeReaction] Success with hub: ${hubUrl}, hash: ${result?.hash}`);
      return result?.hash ?? targetHash;
    } catch (error) {
      console.log(`[removeReaction] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to remove reaction from all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}

// ============================================================================
// Follow Operations
// ============================================================================

/**
 * Sign and submit a follow link to the Farcaster network
 */
export async function signAndSubmitFollow(params: FollowParams): Promise<string> {
  const { fid, privateKey, targetFid } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  const linkBody = {
    type: 'follow',
    targetFid,
  };

  const msgResult = await makeLinkAdd(linkBody, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create follow message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[signAndSubmitFollow] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[signAndSubmitFollow] Success with hub: ${hubUrl}, hash: ${result?.hash}`);
      return result?.hash ?? `follow-${targetFid}`;
    } catch (error) {
      console.log(`[signAndSubmitFollow] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to submit follow to all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}

/**
 * Remove a follow link from the Farcaster network (unfollow)
 */
export async function removeFollow(params: FollowParams): Promise<string> {
  const { fid, privateKey, targetFid } = params;

  const signer = createSigner(privateKey);

  const dataOptions = {
    fid,
    network: FarcasterNetwork.MAINNET,
  };

  const linkBody = {
    type: 'follow',
    targetFid,
  };

  const msgResult = await makeLinkRemove(linkBody, dataOptions, signer);
  if (msgResult.isErr()) {
    throw new HubSubmissionFailedError(`Failed to create unfollow message: ${msgResult.error.message}`, {
      error: msgResult.error,
    });
  }

  const message = msgResult.value;
  let lastError: Error | null = null;

  for (const hubUrl of HUB_ENDPOINTS) {
    try {
      console.log(`[removeFollow] Trying hub: ${hubUrl}`);

      const result = await submitMessageToHub(message, hubUrl);

      console.log(`[removeFollow] Success with hub: ${hubUrl}, hash: ${result?.hash}`);
      return result?.hash ?? `unfollow-${targetFid}`;
    } catch (error) {
      console.log(`[removeFollow] Hub ${hubUrl} failed:`, error?.response?.data?.errCode || error?.message);
      lastError = error;
      continue;
    }
  }

  throw new HubSubmissionFailedError(
    `Failed to remove follow from all Hub endpoints: ${lastError?.message}`,
    {
      lastError: lastError?.response?.data || lastError?.message,
    }
  );
}
