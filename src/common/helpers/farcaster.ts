import axios from 'axios';
import {
  CastAddBody,
  Embed,
  ID_REGISTRY_ADDRESS,
  KEY_GATEWAY_ADDRESS,
  Message,
  NobleEd25519Signer,
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  UserDataType,
  hexStringToBytes,
  idRegistryABI,
  keyGatewayABI,
  makeCastAdd,
  makeUserDataAdd,
  signedKeyRequestValidatorABI,
  CastType,
} from '@farcaster/hub-web';
import { CastAdd, CastId, HubRestAPIClient } from '@standard-crypto/farcaster-js-hub-rest';
import { Address, encodeAbiParameters, toBytes } from 'viem';
import { publicClient, publicClientTestnet } from './rainbowkit';
import { mnemonicToAccount } from 'viem/accounts';
import { isDev } from './env';
import { useTextLength } from '../helpers/editor';

export const WARPCAST_RECOVERY_PROXY: `0x${string}` = '0x00000000FcB080a4D6c39a9354dA9EB9bC104cd7';

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    api_key: process.env.NEXT_PUBLIC_NEYNAR_API_KEY,
  },
});

type PublishReactionParams = {
  authorFid: number;
  privateKey: string;
  reaction: {
    type: 'like' | 'recast';
    target:
      | CastId
      | {
          url: string;
        };
  };
};

type RemoveReactionParams = {
  authorFid: number;
  privateKey: string;
  reaction: {
    type: 'like' | 'recast';
    target:
      | CastId
      | {
          url: string;
        };
  };
};

const getDataOptions = (fid: number) => ({
  fid: fid,
  network: 1,
});

export const removeReaction = async ({ authorFid, privateKey, reaction }: RemoveReactionParams) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance,
  });

  await writeClient.removeReaction(reaction, authorFid, privateKey);
};

export const publishReaction = async ({ authorFid, privateKey, reaction }: PublishReactionParams) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance,
  });

  await writeClient.submitReaction(reaction, authorFid, privateKey);
};

export const followUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({
    axiosInstance,
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
  });
  const followResponse = await client.followUser(targetFid, fid, signerPrivateKey);
  console.log(`follow hash: ${followResponse?.hash}`);
};

export const unfollowUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({
    axiosInstance,
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
  });
  const unfollowResponse = await client.unfollowUser(targetFid, fid, signerPrivateKey);
  console.log(`unfollow hash: ${unfollowResponse?.hash}`);
};

type SubmitCastParams = {
  text: string;
  embeds?: Embed[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentCastId?: CastId;
  parentUrl?: string;
  fid: number;
  signerPrivateKey: string;
};

export const submitCast = async ({
  text,
  embeds,
  mentions,
  mentionsPositions,
  parentCastId,
  parentUrl,
  signerPrivateKey,
  fid,
}: SubmitCastParams) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance,
  });

  // const publishCastResponse = await writeClient.submitCast(
  //   { text, embeds, mentions, mentionsPositions, parentCastId },
  //   fid,
  //   signerPrivateKey
  // );

  // below is copy and adapted from farcaster-js, because the package is missing parentUrl parameter
  // https://github.com/standard-crypto/farcaster-js/blob/be57dedec70ebadbb55118d3a64143457102adb4/packages/farcaster-js-hub-rest/src/hubRestApiClient.ts#L173

  const castType = useTextLength({ text }).isLongCast ? CastType.LONG_CAST : CastType.CAST;

  const dataOptions = getDataOptions(fid);
  const castAdd: CastAddBody = {
    text,
    embeds: embeds ?? [],
    embedsDeprecated: [],
    mentions: mentions ?? [],
    mentionsPositions: mentionsPositions ?? [],
    parentUrl,
    type: castType,
  };
  if (parentCastId !== undefined) {
    const parentHashBytes = hexStringToBytes(parentCastId.hash);
    const parentFid = parentCastId.fid;
    parentHashBytes.match(
      (bytes) => {
        castAdd.parentCastId = {
          fid: parentFid,
          hash: bytes,
        };
      },
      (err) => {
        console.log('submitCast parentCastId error', err);
        throw err;
      }
    );
  }
  const msg = await makeCastAdd(castAdd, dataOptions, new NobleEd25519Signer(toBytes(signerPrivateKey)));
  if (msg.isErr()) {
    throw msg.error;
  }
  console.log('msg', msg);
  const messageBytes = Buffer.from(Message.encode(msg.value).finish());

  const response = await writeClient.apis.submitMessage.submitMessage({
    body: messageBytes,
  });
  const publishCastResponse = response.data as CastAdd;
  console.log(`new cast hash: ${publishCastResponse.hash}`);
  return publishCastResponse.hash;
};

export const removeCast = async (castHash: string, fid: number, signerPrivateKey: string) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance,
  });

  const response = await writeClient.removeCast(castHash, fid, signerPrivateKey);
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

export const setUserDataInProtocol = async (privateKey: string, fid: number, type: UserDataType, value: string) => {
  const signer = new NobleEd25519Signer(toBytes(privateKey));
  const dataOptions = getDataOptions(fid);

  const msg = await makeUserDataAdd({ type, value }, dataOptions, signer);

  if (msg.isErr()) {
    throw msg.error;
  }
  const messageBytes = Buffer.from(Message.encode(msg.value).finish());
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance,
  });
  const response = await writeClient.apis.submitMessage.submitMessage({
    body: messageBytes,
  });
  return response.data;
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
  return new Uint8Array(Buffer.from(hash.slice(2), 'hex'));
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

// Define Farcaster embed types
export type FarcasterEmbed = FarcasterUrlEmbed | FarcasterCastIdEmbed;

export interface FarcasterUrlEmbed {
  url: string;
}

export interface FarcasterCastIdEmbed {
  castId: {
    fid: number;
    hash: Uint8Array | string;
  };
}

export const isFarcasterUrlEmbed = (embed: FarcasterEmbed): embed is FarcasterUrlEmbed => {
  return 'url' in embed;
};

export const isFarcasterCastIdEmbed = (embed: FarcasterEmbed): embed is FarcasterCastIdEmbed => {
  return 'castId' in embed;
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
  embeds: Embed[];
  getMentionFidsByUsernames: (usernames: string[]) => Promise<Array<{ username: string; fid: number } | null>>;
  parentUrl?: string;
  parentCastFid?: number;
  parentCastHash?: string;
}): Promise<CastAddBody | false> {
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
  const targetHashBytes = parentCastHash ? stringHashToUint(parentCastHash) : false;

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
    embeds: embeds.map((embed) => {
      if (isFarcasterCastIdEmbed(embed) && embed.castId) {
        return { castId: embed.castId };
      }
      if (isFarcasterUrlEmbed(embed) && embed.url) {
        return { url: embed.url };
      }
      return embed;
    }),
  };

  return castBody;
}
