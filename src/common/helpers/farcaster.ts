import {
  CastAddBody, FarcasterNetwork,
  NobleEd25519Signer,
  ReactionBody,
  getHubRpcClient,
  makeCastAdd,
  makeReactionAdd,
  makeReactionRemove,
} from "@farcaster/hub-web";
import { toBytes } from 'viem';
import { DraftType } from "@/common/constants/farcaster";
import isEmpty from 'lodash.isempty';
import get from "lodash.get";
import { getUrlsInText } from "@/common/helpers/text";

const NETWORK = FarcasterNetwork.MAINNET;

export const convertEditorCastToPublishableCast = async (draft: DraftType): Promise<CastAddBody> => {
  // console.log(`input text "${draft.text}", length:`, draft.text.length)
  const text = draft.text;
  const parentUrl = draft.parentUrl;
  const embeds = getUrlsInText(text);

  let cast: CastAddBody = {
    text,
    embeds,
    embedsDeprecated: [],
    mentions: [],
    mentionsPositions: [],
  }

  const mentionRegex = /\s?@([a-zA-z.]+)/g;
  let match;
  let idxReducedByPreviousMentions = 0;

  while ((match = mentionRegex.exec(text)) != null) {
    // match contains [@username, username]

    const casterUsername = match[1];
    const isStartingCastWithMention = match.index === 0;
    if (!isStartingCastWithMention && casterUsername.startsWith(' ')) {
      continue;
    }

    const fid = get(draft.mentionsToFids, casterUsername)

    if (!fid) {
      const err = `Failed to mention ${casterUsername} - couldn't post this cast, got no fid for user "${casterUsername}"`;
      console.log(err);
      continue;
    }

    const matchIndex = match.index + (isStartingCastWithMention ? 0 : 1);
    cast = {
      ...cast,
      text: cast.text.replace(isStartingCastWithMention ? match[0] : `@${match[1]}`, ''),
      mentions: [...cast.mentions, Number(fid)],
      mentionsPositions: [...cast.mentionsPositions, matchIndex - idxReducedByPreviousMentions]
    }
    const matchLength = (isStartingCastWithMention ? match[0] : `@${match[1]}`).length;
    idxReducedByPreviousMentions = idxReducedByPreviousMentions + matchLength;
  }

  if (!isEmpty(draft.parentCastId)) {
    cast = {
      ...cast,
      parentCastId: {
        hash: toBytes(draft.parentCastId.hash),
        fid: Number(draft.parentCastId.fid),
      }
    }
  } else if (parentUrl) {
    cast = {
      ...cast,
      parentUrl,
    }
  }
  // console.log('convertEditorCastToPublishableCast done, result:', { ...cast })
  return cast;
}

type PublishCastParams = {
  authorFid: string;
  privateKey: string;
  castBody: CastAddBody;
};

type PublishReactionParams = {
  authorFid: number;
  privateKey: string;
  reactionBody: ReactionBody;
};

type RemoveReactionParams = {
  authorFid: number;
  privateKey: string;
  reactionBody: ReactionBody;
}

export const publishCast = async ({ authorFid, privateKey, castBody }: PublishCastParams) => {
  if (!process.env.NEXT_PUBLIC_NEYNAR_HUB_URL) {
    throw new Error('hub url is not defined');
  }

  // console.log(`publishCast - fid ${authorFid} cast: ${JSON.stringify(castBody)}`)
  // const wallet = new Wallet(privateKey);
  // Create an EIP712 Signer with the wallet that holds the custody address of the user
  const ed25519Signer = new NobleEd25519Signer(toBytes(privateKey));

  const dataOptions = {
    fid: Number(authorFid),
    network: NETWORK,
  };

  // console.log('publishCast - dataOptions', { ...dataOptions }, 'castBody', { ...castBody })
  // Step 2: create message
  const cast = await makeCastAdd(
    castBody,
    dataOptions,
    ed25519Signer,
  );

  // console.log('cast right before sending to hub', { ...cast });

  // Step 3: publish message to network
  const client = getHubRpcClient(process.env.NEXT_PUBLIC_NEYNAR_HUB_URL, { debug: true });
  const res = await Promise.resolve(cast.map(async (castAdd) => {
    return await Promise.resolve(await client.submitMessage(castAdd));
  }));


  // const res2 = await Promise.resolve(res).then((res) => {
  //   console.log('res', res)
  //   return res
  // }).catch((err) => {
  //   console.log('err', err)
  // });

  console.log(`Submitted cast to Farcaster network, res:`, res);
  return res;
  // client.close();
};

export const removeReaction = async ({ authorFid, privateKey, reactionBody }: RemoveReactionParams) => {
  if (!process.env.NEXT_PUBLIC_NEYNAR_HUB_URL) {
    throw new Error('hub url is not defined');
  }

  try {
    // Create an EIP712 Signer with the wallet that holds the custody address of the user
    const signer = getEIP712Signer(privateKey);

    const dataOptions = {
      fid: Number(authorFid),
      network: NETWORK,
    };

    // Step 2: create message
    const reaction = await makeReactionRemove(
      reactionBody,
      dataOptions,
      signer,
    );

    // Step 3: publish message to network
    const client = getHubRpcClient(process.env.NEXT_PUBLIC_NEYNAR_HUB_URL, { debug: true });
    const res = await Promise.resolve(reaction.map(async (reactionRemove) => {
      return await Promise.resolve(await client.submitMessage(reactionRemove));
    }));

    console.log(`Submitted removing reaction to Farcaster network, res:`, res);
    return res;
  } catch (error) {
    console.error(`Error in submitMessage: ${error}`);
    throw error;
  }
};


const getEIP712Signer = (privateKey: string): NobleEd25519Signer => {
  return new NobleEd25519Signer(toBytes(privateKey));
}
export const publishReaction = async ({ authorFid, privateKey, reactionBody }: PublishReactionParams) => {
  if (!process.env.NEXT_PUBLIC_NEYNAR_HUB_URL) {
    throw new Error('hub url is not defined');
  }

  try {
    // Create an EIP712 Signer with the wallet that holds the custody address of the user
    const signer = getEIP712Signer(privateKey);

    const dataOptions = {
      fid: Number(authorFid),
      network: NETWORK,
    };

    // console.log('publishReaction - dataOptions', { ...dataOptions }, 'reactionBody', { ...reactionBody })
    // Step 2: create message
    const reaction = await makeReactionAdd(
      reactionBody,
      dataOptions,
      signer,
    );

    // Step 3: publish message to network
    const client = getHubRpcClient(process.env.NEXT_PUBLIC_NEYNAR_HUB_URL, { debug: true });
    const res = await Promise.resolve(reaction.map(async (reactionAdd) => {
      return await Promise.resolve(await client.submitMessage(reactionAdd));
    }));

    console.log(`Submitted reaction to Farcaster network, res:`, res);
    return res;
  } catch (error) {
    console.error(`Error in submitMessage: ${error}`);
    throw error;
  }
};

import { HubRestAPIClient } from '@standard-crypto/farcaster-js-hub-rest';

export const followUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({ hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL });
  const followResponse = await client.followUser(targetFid, fid, signerPrivateKey);
  console.log(`follow hash: ${followResponse?.hash}`);
}

export const unfollowUser = async (targetFid: number, fid: number, signerPrivateKey: string) => {
  const client = new HubRestAPIClient({ hubUrl: process.env.NEXT_PUBLIC_HUB_HTTP_URL });
  const unfollowResponse = await client.unfollowUser(targetFid, fid, signerPrivateKey);
  console.log(`unfollow hash: ${unfollowResponse?.hash}`);
}