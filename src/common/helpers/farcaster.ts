import axios from "axios";
import { Embed } from "@farcaster/hub-web";
import { CastId, HubRestAPIClient } from '@standard-crypto/farcaster-js-hub-rest';

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
  fid: number;
  signerPrivateKey: string;
}

export const submitCast = async ({
  text,
  embeds,
  mentions,
  mentionsPositions,
  signerPrivateKey,
  fid,
}: SubmitCastParams) => {
  const writeClient = new HubRestAPIClient({ 
    hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL,
    axiosInstance 
  });
  
  const publishCastResponse = await writeClient.submitCast(
    { text, embeds, mentions, mentionsPositions }, 
    fid, 
    signerPrivateKey
  );
  console.log(`new cast hash: ${publishCastResponse.hash}`);
}


export const getDeadline = () => {
  const now = Math.floor(Date.now() / 1000);
  const oneHour = 60 * 60;
  return now + oneHour;
};

