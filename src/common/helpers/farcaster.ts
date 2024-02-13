import axios from "axios";
import { CastAddBody, Embed, KEY_GATEWAY_ADDRESS, Message, NobleEd25519Signer, SIGNED_KEY_REQUEST_TYPE, SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS, SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN, ViemLocalEip712Signer, hexStringToBytes, keyGatewayABI, makeCastAdd, signedKeyRequestValidatorABI } from "@farcaster/hub-web";
import { CastAdd, CastId, HubRestAPIClient, SubmitMessageApi } from '@standard-crypto/farcaster-js-hub-rest';
import { encodeAbiParameters, toBytes } from "viem";
import { publicClient } from "./rainbowkit";
import { mnemonicToAccount } from "viem/accounts";
import { readContract } from "viem/actions";

export const WARPCAST_RECOVERY_PROXY: `0x${string}` = '0x00000000FcB080a4D6c39a9354dA9EB9bC104cd7';

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY
  }
});

type PublishReactionParams = {
  authorFid: number;
  privateKey: string;
  reaction: {
    type: 'like' | 'recast';
    target: CastId | {
      url: string;
    };
  };
};

type RemoveReactionParams = {
  authorFid: number;
  privateKey: string;
  reaction: {
    type: 'like' | 'recast';
    target: CastId | {
      url: string;
    };
  };
}

export const removeReaction = async ({ authorFid, privateKey, reaction }: RemoveReactionParams) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance
  });

  const submitReactionResponse = await writeClient.removeReaction(
    reaction,
    authorFid,
    privateKey
  );
  console.log(`new reaction hash: ${submitReactionResponse.hash}`)
};

export const publishReaction = async ({ authorFid, privateKey, reaction }: PublishReactionParams) => {
  const writeClient = new HubRestAPIClient({
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance
  });

  const submitReactionResponse = await writeClient.submitReaction(
    reaction,
    authorFid,
    privateKey
  );
  console.log(`new reaction hash: ${submitReactionResponse.hash}`);
};

export const followUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({ axiosInstance, hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL });
  const followResponse = await client.followUser(targetFid, fid, signerPrivateKey);
  console.log(`follow hash: ${followResponse?.hash}`);
}

export const unfollowUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({ axiosInstance, hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL });
  const unfollowResponse = await client.unfollowUser(targetFid, fid, signerPrivateKey);
  console.log(`unfollow hash: ${unfollowResponse?.hash}`);
}

type SubmitCastParams = {
  text: string;
  embeds?: Embed[];
  mentions?: number[];
  mentionsPositions?: number[];
  parentCastId?: CastId;
  parentUrl?: string;
  fid: number;
  signerPrivateKey: string;
}

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
    axiosInstance
  });

  // const publishCastResponse = await writeClient.submitCast(
  //   { text, embeds, mentions, mentionsPositions, parentCastId }, 
  //   fid, 
  //   signerPrivateKey
  // );

  // below is copy and adapted from farcaster-js, because the package is missing parentUrl parameter
  // https://github.com/standard-crypto/farcaster-js/blob/be57dedec70ebadbb55118d3a64143457102adb4/packages/farcaster-js-hub-rest/src/hubRestApiClient.ts#L173

  const dataOptions = {
    fid: fid,
    network: 1,
  };
  const castAdd: CastAddBody = {
    text,
    embeds: embeds ?? [],
    embedsDeprecated: [],
    mentions: mentions ?? [],
    mentionsPositions: mentionsPositions ?? [],
    parentUrl,
  };
  if (parentCastId !== undefined) {
    const parentHashBytes = hexStringToBytes(parentCastId.hash);
    const parentFid = parentCastId.fid;
    parentHashBytes.match(bytes => {
      castAdd.parentCastId = {
        fid: parentFid,
        hash: bytes,
      };
    }, (err) => {
      throw err;
    });
  }
  const msg = await makeCastAdd(
    castAdd,
    dataOptions,
    new NobleEd25519Signer(toBytes(signerPrivateKey))
  );
  if (msg.isErr()) {
    throw msg.error;
  }
  const messageBytes = Buffer.from(Message.encode(msg.value).finish());

  const response = await writeClient.apis.submitMessage.submitMessage({
    body: messageBytes,
  });
  const publishCastResponse = response.data as CastAdd;
  console.log(`new cast hash: ${publishCastResponse.hash}`);
}


export const getDeadline = (): bigint => {
  const now = Math.floor(Date.now() / 1000);
  const oneHour = 60 * 60;
  return BigInt(now + oneHour);
};


export const readNoncesFromKeyGateway = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    abi: keyGatewayABI,
    address: KEY_GATEWAY_ADDRESS,
    functionName: "nonces",
    args: [account],
  });
};


export async function isValidSignedKeyRequest(
  config,
  fid: bigint,
  key: `0x${string}`,
  signedKeyRequest: `0x${string}`
): Promise<boolean> {
  const res = await readContract(config, {
    address: SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
    abi: signedKeyRequestValidatorABI,
    functionName: "validate",
    args: [fid, key, signedKeyRequest],
  });
  return res;
}

export const getSignedKeyRequestMetadataFromAppAccount = async (signerPublicKey: `0x${string}`, deadline: bigint) => {
  const appAccount = mnemonicToAccount(process.env.NEXT_PUBLIC_APP_MNENOMIC!);
  const fid = BigInt(process.env.NEXT_PUBLIC_APP_FID!);

  const signature = await appAccount.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: "SignedKeyRequest",
    message: {
      requestFid: fid,
      key: signerPublicKey,
      deadline,
    },
  });

  return encodeAbiParameters(
    [
      {
        components: [
          {
            name: "requestFid",
            type: "uint256",
          },
          {
            name: "requestSigner",
            type: "address",
          },
          {
            name: "signature",
            type: "bytes",
          },
          {
            name: "deadline",
            type: "uint256",
          },
        ],
        type: "tuple",
      },
    ],
    [
      {
        requestFid: fid,
        requestSigner: appAccount.address,
        signature,
        deadline,
      },
    ]
  );
}
