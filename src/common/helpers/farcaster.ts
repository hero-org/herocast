import {
  type CastAddBody,
  type Embed as HubEmbed,
  ID_REGISTRY_ADDRESS,
  idRegistryABI,
  KEY_GATEWAY_ADDRESS,
  keyGatewayABI,
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  signedKeyRequestValidatorABI,
  type UserDataType,
} from '@farcaster/hub-web';
import axios from 'axios';
import { type Address, encodeAbiParameters } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import type { FarcasterEmbed } from '@/common/types/embeds';
import { useTextLength } from '../helpers/editor';
import { isDev } from './env';
import { publicClient, publicClientTestnet } from './rainbowkit';
import { createClient } from './supabase/component';

export const WARPCAST_RECOVERY_PROXY: `0x${string}` = '0x00000000FcB080a4D6c39a9354dA9EB9bC104cd7';

type CastId = {
  fid: number;
  hash: string | Uint8Array;
};

type FarcasterEmbedInput = FarcasterEmbed | { castId: CastId };

type SignerServiceSuccess = {
  success: true;
  hash: string;
  fid?: number;
};

type SignerServiceError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

type SignerServiceResponse = SignerServiceSuccess | SignerServiceError;

const getSignerServiceUrl = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for signer service.');
  }
  return `${supabaseUrl}/functions/v1/farcaster-signer`;
};

const ensureHexHash = (hash: string | Uint8Array): string => {
  if (typeof hash === 'string') {
    return hash.startsWith('0x') ? hash : `0x${hash}`;
  }
  return `0x${Buffer.from(hash).toString('hex')}`;
};

const toSignerEmbed = (embed: FarcasterEmbedInput) => {
  if ('castId' in embed && embed.castId) {
    return {
      cast_id: {
        fid: Number(embed.castId.fid),
        hash: ensureHexHash(embed.castId.hash),
      },
    };
  }
  if ('url' in embed && embed.url) {
    return { url: embed.url };
  }
  throw new Error('Invalid embed format for signer service');
};

const callSignerService = async (
  path: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>
): Promise<SignerServiceSuccess> => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for signer service.');
  }

  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('You must be signed in to use the signer service.');
  }

  const response = await fetch(`${getSignerServiceUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });

  let data: SignerServiceResponse | null = null;
  try {
    data = (await response.json()) as SignerServiceResponse;
  } catch {
    // Ignore JSON parse errors and handle via response status below.
  }

  if (!response.ok || !data || data.success === false) {
    const errorMessage = data?.success === false ? data.error.message : `Signer service failed (${response.status})`;
    const errorCode = data?.success === false ? data.error.code : undefined;
    const message = errorCode ? `${errorCode}: ${errorMessage}` : errorMessage;
    throw new Error(message);
  }

  return data;
};

type PublishReactionParams = {
  accountId: string;
  reaction: {
    type: 'like' | 'recast';
    target: CastId;
  };
};

type RemoveReactionParams = {
  accountId: string;
  reaction: {
    type: 'like' | 'recast';
    target: CastId;
  };
};

export const removeReaction = async ({ accountId, reaction }: RemoveReactionParams) => {
  await callSignerService('/reaction', 'DELETE', {
    account_id: accountId,
    type: reaction.type,
    target: {
      fid: reaction.target.fid,
      hash: ensureHexHash(reaction.target.hash),
    },
  });
};

export const publishReaction = async ({ accountId, reaction }: PublishReactionParams) => {
  await callSignerService('/reaction', 'POST', {
    account_id: accountId,
    type: reaction.type,
    target: {
      fid: reaction.target.fid,
      hash: ensureHexHash(reaction.target.hash),
    },
  });
};

export const followUser = async (accountId: string, targetFid: number) => {
  const response = await callSignerService('/follow', 'POST', {
    account_id: accountId,
    target_fid: targetFid,
  });
  console.log(`follow hash: ${response?.hash}`);
};

export const unfollowUser = async (accountId: string, targetFid: number) => {
  const response = await callSignerService('/follow', 'DELETE', {
    account_id: accountId,
    target_fid: targetFid,
  });
  console.log(`unfollow hash: ${response?.hash}`);
};

type SubmitCastParams = {
  text: string;
  embeds?: FarcasterEmbedInput[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentCastId?: {
    fid: number;
    hash: string | Uint8Array;
  };
  parentUrl?: string;
  accountId: string;
  isPro?: boolean;
  channelId?: string;
  idempotencyKey?: string;
};

export const submitCast = async ({
  text,
  embeds,
  mentions,
  mentionsPositions,
  parentCastId,
  parentUrl,
  accountId,
  isPro = false,
  channelId,
  idempotencyKey,
}: SubmitCastParams) => {
  const castType = useTextLength({ text, isPro }).isLongCast ? 'long_cast' : 'cast';
  const response = await callSignerService('/cast', 'POST', {
    account_id: accountId,
    text,
    embeds: embeds?.map(toSignerEmbed),
    mentions,
    mentions_positions: mentionsPositions,
    parent_cast_id: parentCastId
      ? {
          fid: parentCastId.fid,
          hash: ensureHexHash(parentCastId.hash),
        }
      : undefined,
    parent_url: parentUrl,
    channel_id: channelId,
    idempotency_key: idempotencyKey,
    cast_type: castType,
  });

  console.log(`new cast hash: ${response.hash}`);
  return response.hash;
};

export const removeCast = async (accountId: string, castHash: string) => {
  const response = await callSignerService('/cast', 'DELETE', {
    account_id: accountId,
    cast_hash: ensureHexHash(castHash),
  });
  console.log(`remove cast hash: ${response?.hash}`);
};

export const getDeadline = (): bigint => {
  const now = Math.floor(Date.now() / 1000);
  const oneHour = 60 * 60;
  return BigInt(now + oneHour);
};

export const getTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

export const readNoncesFromKeyGateway = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    abi: keyGatewayABI,
    address: KEY_GATEWAY_ADDRESS,
    functionName: 'nonces',
    args: [account],
  });
};

export async function isValidSignedKeyRequest(
  fid: bigint,
  key: `0x${string}`,
  signedKeyRequest: `0x${string}`
): Promise<boolean> {
  const res = await publicClient.readContract({
    address: SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
    abi: signedKeyRequestValidatorABI,
    functionName: 'validate',
    args: [fid, key, signedKeyRequest],
  });
  return res;
}

export const getSignedKeyRequestMetadataFromAppAccount = async (
  chainId: number,
  signerPublicKey: `0x${string}`,
  deadline: bigint | number
) => {
  const appAccount = mnemonicToAccount(process.env.NEXT_PUBLIC_APP_MNENOMIC!);
  const fid = BigInt(process.env.NEXT_PUBLIC_APP_FID!);

  const signature = await appAccount.signTypedData({
    domain: {
      ...SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      chainId,
    },
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: 'SignedKeyRequest',
    message: {
      requestFid: fid,
      key: signerPublicKey,
      deadline: BigInt(deadline),
    },
  });

  return encodeAbiParameters(
    [
      {
        components: [
          {
            name: 'requestFid',
            type: 'uint256',
          },
          {
            name: 'requestSigner',
            type: 'address',
          },
          {
            name: 'signature',
            type: 'bytes',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
        type: 'tuple',
      },
    ],
    [
      {
        requestFid: fid,
        requestSigner: appAccount.address,
        deadline: BigInt(deadline),
        signature,
      },
    ]
  );
};

const IdContract = {
  abi: idRegistryABI,
  address: ID_REGISTRY_ADDRESS,
  chain: 10,
};

export const getFidForAddress = async (address: `0x${string}`): Promise<bigint | undefined> => {
  if (!address) return;

  const client = isDev() ? publicClientTestnet : publicClient;

  return await client.readContract({
    ...IdContract,
    functionName: 'idOf',
    args: [address],
  });
};

const FARCASTER_FNAME_ENDPOINT = 'https://fnames.farcaster.xyz/transfers';

// example implementation here:
// https://github.com/us3r-network/u3/blob/a6910b01fa0cf5cdba384f935544c6ba94dc7d64/apps/u3/src/components/social/farcaster/signupv2/FnameRegister.tsx

export const validateUsernameIsAvailable = async (username: string) => {
  console.log('validateUsernameIsAvailable', username);

  const response = await axios.get(`${FARCASTER_FNAME_ENDPOINT}?name=${username}`);
  if (response.status !== 200) {
    throw new Error('Failed to validate username');
  }

  const transfers = response.data.transfers;
  return transfers.length === 0;
};

export const getUsernameForFid = async (fid: number) => {
  const response = await axios.get(`${FARCASTER_FNAME_ENDPOINT}?fid=${fid}`);
  if (response.status !== 200) {
    throw new Error('Failed to get username for fid');
  }

  const transfers = response.data.transfers.filter((t) => t.to === fid);
  if (transfers.length === 0) {
    return undefined;
  } else {
    return transfers[transfers.length - 1].username;
  }
};

type UpdateUsernameParams = {
  fid: string;
  username: string;
  timestamp: number;
  owner: `0x${string}`;
  signature: `0x${string}`;
  toFid?: string;
  fromFid?: string;
};

export const updateUsernameOffchain = async ({
  fid,
  fromFid,
  toFid,
  username,
  timestamp,
  owner,
  signature,
}: UpdateUsernameParams) => {
  console.log('updateUsername', username, fid, fromFid, toFid);
  if (!fromFid && !toFid) {
    throw new Error('fromFid or toFid must be provided');
  }
  // {
  //   "name": "hubble", // Name to register
  //   "from": 0,  // Fid to transfer from (0 for a new registration)
  //   "to": 123, // Fid to transfer to (0 to unregister)
  //   "fid": 123, // Fid making the request (must match from or to)
  //   "owner": "0x...", // Custody address of fid making the request
  //   "timestamp": 1641234567,  // Current timestamp in seconds
  //   "signature": "0x..."  // EIP-712 signature signed by the custody address of the fid
  // }
  console.log(
    `making request to ${FARCASTER_FNAME_ENDPOINT} with username: ${username}, fid: ${fid}, owner: ${owner}, signature: ${signature}`
  );
  try {
    const payload = {
      name: username,
      fid: Number(fid),
      to: Number(toFid),
      from: Number(fromFid),
      owner,
      timestamp,
      signature,
    };

    console.log('updateUsername payload', payload);
    const res = await axios.post(FARCASTER_FNAME_ENDPOINT, payload);
    console.log('updateUsername response', res, res?.data);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return res.data;
  } catch (e: any) {
    console.error('updateUsername error', e);
    if (e.response.data.code === 'THROTTLED') throw new Error('You can only change your username every 28 days.');
    else
      throw new Error('Failed to register current username: ' + e.response.data?.error + ' ' + e.response.data?.code);
  }
};

export const setUserDataInProtocol = async (accountId: string, type: UserDataType, value: string) => {
  const response = await callSignerService('/user-data', 'POST', {
    account_id: accountId,
    type,
    value,
  });
  return response.hash;
};

const EIP_712_USERNAME_PROOF = [
  { name: 'name', type: 'string' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'owner', type: 'address' },
];

const EIP_712_USERNAME_DOMAIN = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  verifyingContract: '0xe3Be01D99bAa8dB9905b33a3cA391238234B79D1' as Address,
};

const USERNAME_PROOF_EIP_712_TYPES = {
  domain: EIP_712_USERNAME_DOMAIN,
  types: { UserNameProof: EIP_712_USERNAME_PROOF },
};

export const getSignatureForUsernameProof = async (
  client,
  address,
  message: {
    name: string;
    owner: string;
    timestamp: bigint;
  }
): Promise<`0x${string}` | undefined> => {
  if (!address || !client) return;

  const signature = await client.signTypedData({
    ...USERNAME_PROOF_EIP_712_TYPES,
    account: address,
    primaryType: 'UserNameProof',
    message: message,
  });
  console.log('getSignatureForUsernameProof:', signature);
  return signature;
};

export const updateBio = async () => {};

// Utility function to convert hex string to Uint8Array
export function stringHashToUint(hash: string): Uint8Array {
  if (!hash || typeof hash !== 'string') {
    throw new Error(`stringHashToUint: invalid hash - expected string, got ${typeof hash}`);
  }
  if (!hash.startsWith('0x')) {
    throw new Error(`stringHashToUint: hash must start with 0x prefix, got: ${hash.slice(0, 10)}`);
  }
  const bytes = new Uint8Array(Buffer.from(hash.slice(2), 'hex'));
  if (bytes.length !== 20) {
    console.warn(`[stringHashToUint] Unexpected hash length: ${bytes.length} bytes (expected 20)`, hash);
  }
  return bytes;
}

// Types needed for structured cast
type StructuredCastUnit = StructuredCastText | StructuredCastMention | StructuredCastURL;

type StructuredCastText = {
  type: 'text';
  serializedContent: string;
};

type StructuredCastMention = {
  type: 'mention';
  serializedContent: string;
};

type StructuredCastURL = {
  type: 'url' | 'videourl';
  serializedContent: string;
};

// Maximum number of embeds allowed in a Farcaster cast
export const FARCASTER_MAX_EMBEDS = 2;

// Local implementation of getMentionFidsByUsernames using Neynar API directly
export const getMentionFidsByUsernames = () => {
  return async (usernames: string[]): Promise<Array<{ username: string; fid: number } | null>> => {
    try {
      const results = await Promise.all(
        usernames.map(async (username) => {
          try {
            const response = await axios.get(
              `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
              {
                headers: {
                  'x-api-key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY,
                },
              }
            );

            // Transform Neynar response to expected format
            if (response.data && response.data.user) {
              return {
                username: response.data.user.username,
                fid: response.data.user.fid,
              };
            }
            return null;
          } catch (e) {
            console.error(`Failed to fetch data for username ${username}`, e);
            return null;
          }
        })
      );
      return results;
    } catch (error) {
      console.error('Failed to fetch user data for mentions', error);
      return [];
    }
  };
};

// Convert plain text to structured format with mentions
export function convertCastPlainTextToStructured({ text }: { text: string }): StructuredCastUnit[] {
  const result: StructuredCastUnit[] = [];

  // Simple regex to match @mentions
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  let lastIndex = 0;
  let match;

  // Function to process the text and extract mentions and URLs
  const processText = (regex: RegExp, type: 'mention' | 'url') => {
    regex.lastIndex = 0; // Reset regex state
    const matches: { index: number; content: string; type: 'mention' | 'url' }[] = [];

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        content: match[0],
        type,
      });
    }

    return matches;
  };

  // Get all mentions and URLs
  const mentions = processText(mentionRegex, 'mention');
  const urls = processText(urlRegex, 'url');

  // Combine and sort by index
  const allMatches = [...mentions, ...urls].sort((a, b) => a.index - b.index);

  // Process matches in order
  for (const match of allMatches) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        serializedContent: text.substring(lastIndex, match.index),
      });
    }

    // Add the match
    result.push({
      type: match.type,
      serializedContent: match.content,
    });

    lastIndex = match.index + match.content.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      serializedContent: text.substring(lastIndex),
    });
  }

  return result;
}

// Format plaintext to hub cast message
export async function formatPlaintextToHubCastMessage({
  text,
  embeds,
  parentCastFid,
  parentCastHash,
  parentUrl,
  getMentionFidsByUsernames,
}: {
  text: string;
  embeds: FarcasterEmbedInput[];
  getMentionFidsByUsernames: (usernames: string[]) => Promise<Array<{ username: string; fid: number } | null>>;
  parentUrl?: string;
  parentCastFid?: number;
  parentCastHash?: string;
}): Promise<Omit<CastAddBody, 'type'> | false> {
  // Check against maximum allowed embeds
  if (embeds.length > FARCASTER_MAX_EMBEDS) {
    return false;
  }

  // Structure the cast text
  const structuredCast = convertCastPlainTextToStructured({
    text,
  });

  // Extract mentions
  const mentionCandidates = structuredCast.filter((x) => x.type === 'mention');

  let formattedText = '';
  const mentions: number[] = [];
  let remainingMentions: Array<{ fid: number; username: string }> = [];
  const mentionsPositions: number[] = [];

  if (mentionCandidates.length) {
    const fetchedMentionFids = await getMentionFidsByUsernames(
      mentionCandidates.map((x) => x.serializedContent.replace('@', ''))
    );

    const validMentions = mentionCandidates
      .map((mentionCandidate, index) => {
        const matchedUser = fetchedMentionFids[index];
        return {
          fid: matchedUser?.fid,
          username: mentionCandidate.serializedContent,
        };
      })
      // Only include mentions we can find FIDs for
      .filter((x): x is { fid: number; username: string } => !!x.fid)
      // Farcaster allows max 5 mentions
      .slice(0, 5);

    remainingMentions = validMentions;
  }

  // Process the structured cast to build the final text with mentions
  structuredCast.forEach((unit) => {
    if (
      unit.type === 'mention' &&
      remainingMentions.length &&
      remainingMentions[0].username === unit.serializedContent
    ) {
      const encodedText = new TextEncoder().encode(formattedText);
      // Track position by bytes, not characters
      mentionsPositions.push(encodedText.length);
      mentions.push(remainingMentions[0].fid);
      remainingMentions = remainingMentions.slice(1);
    } else {
      formattedText = formattedText + unit.serializedContent;
    }
  });

  // Process parent cast if provided
  let targetHashBytes: Uint8Array | false = false;
  if (parentCastHash) {
    console.log('[formatPlaintextToHubCastMessage] Converting parentCastHash:', {
      type: typeof parentCastHash,
      value: parentCastHash.slice(0, 12) + '...',
    });

    if (typeof parentCastHash !== 'string' || !parentCastHash.startsWith('0x')) {
      console.error('[formatPlaintextToHubCastMessage] Invalid parentCastHash format:', parentCastHash);
      throw new Error('Invalid parentCastHash format - expected hex string with 0x prefix');
    }

    targetHashBytes = stringHashToUint(parentCastHash);
    console.log('[formatPlaintextToHubCastMessage] parentCastHash converted, bytes length:', targetHashBytes.length);
  }

  const normalizedEmbeds: HubEmbed[] = embeds.map((embed) => {
    if ('castId' in embed && embed.castId) {
      const hashBytes =
        typeof embed.castId.hash === 'string' ? stringHashToUint(ensureHexHash(embed.castId.hash)) : embed.castId.hash;
      return {
        castId: {
          fid: Number(embed.castId.fid),
          hash: hashBytes,
        },
      };
    }
    if ('url' in embed && embed.url) {
      return { url: embed.url };
    }
    throw new Error('Invalid embed format for cast body');
  });

  // Build the final cast body
  const castBody = {
    text: formattedText,
    mentions: mentions,
    embedsDeprecated: [],
    mentionsPositions: mentionsPositions,
    ...(parentCastFid && targetHashBytes
      ? {
          parentCastId: {
            fid: parentCastFid,
            hash: targetHashBytes,
          },
        }
      : parentUrl
        ? {
            parentUrl: parentUrl,
          }
        : {}),
    embeds: normalizedEmbeds,
  };

  return castBody;
}
