import {
  CastAddBody, FarcasterNetwork,
  NobleEd25519Signer,
  getHubRpcClient,
  makeCastAdd,
} from "@farcaster/hub-web";
import { toBytes } from 'viem';
import casterData from '@/assets/data/casters-2023-08-26.json';


export const VITE_NEYNAR_HUB_URL = import.meta.env.VITE_NEYNAR_HUB_URL;
const NETWORK = FarcasterNetwork.MAINNET;


type CasterType = {
  fid: number
  username?: string
  display_name?: string
}

export const getCasterData = (): CasterType[] => {
  return casterData;
}

export const convertEditorCastToPublishableCast = (text: string, parentUrl?: string, parentHash?: string): CastAddBody => {
  let cast = {
    text,
    embeds: [],
    embedsDeprecated: [],
    mentions: [],
    mentionsPositions: [],
  }

  let match;
  const mentionRegex = /@(\S+)/g;
  while ((match = mentionRegex.exec(text)) != null) {
    // match is [@username, username]
    console.log(`Found ${JSON.stringify(match)} start=${match.index}`);

    const casterUsername = match[1];
    console.log('casterData first 10 items:', casterData.slice(0, 10));
    console.log('casterUsername:', casterUsername)
    const fid = casterData.find(caster => caster.username === casterUsername)?.fid;
    if (fid) {
      cast = {
        ...cast,
        text: cast.text.replace(match[0], ''),
        mentions: [...cast.mentions, fid],
        mentionsPositions: [...cast.mentionsPositions, match.index]
      }
    } else {
      throw new Error(`Failed to mention ${casterUsername} - couldn't post this cast`);
    }
  };

  if (parentUrl) {
    cast = {
      ...cast,
      parentUrl,
    }
  }

  return cast;
}

type PublishCastParams = {
  authorFid: string;
  privateKey: string;
  castBody: CastAddBody;
};

export const publishCast = async ({ authorFid, privateKey, castBody }: PublishCastParams) => {
  if (!VITE_NEYNAR_HUB_URL) {
    throw new Error('HUB_URL is not defined');
  }

  console.log(`publishCast - fid ${authorFid} cast: ${JSON.stringify(castBody)}`)
  // const wallet = new Wallet(privateKey);
  // Create an EIP712 Signer with the wallet that holds the custody address of the user
  const ed25519Signer = new NobleEd25519Signer(toBytes(privateKey));

  const dataOptions = {
    fid: Number(authorFid),
    network: NETWORK,
  };


  // Step 2: create message
  const cast = await makeCastAdd(
    castBody,
    dataOptions,
    ed25519Signer,
  );

  // Step 3: publish message to network
  const client = getHubRpcClient(VITE_NEYNAR_HUB_URL, { debug: true });
  const res = await cast.map(async (castAdd) => {
    return await client.submitMessage(castAdd);
  });
  // Result<Promise<HubResult<Mesage>>, HubError>
  const res2 = await Promise.resolve(res);
  console.log('res2', res2);
  // console.log('res?.value', { val });

  console.log(`Submitted cast to Farcaster network`);

  // client.close();
};



///// EXAMPLES GO BELOW

/**
   * Example 1: A cast with no mentions
   *
   * "This is a cast with no mentions"
   */

  // const cast = await makeCastAdd(
  //   castBody,
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(cast);

  // /**
  //  * Example 2: A cast with mentions
  //  *
  //  * "@dwr and @v are big fans of @farcaster"
  //  */
  // const castWithMentions = await makeCastAdd(
  //   {
  //     text: " and  are big fans of ",
  //     embeds: [],
  //     embedsDeprecated: [],
  //     mentions: [3, 2, 1],
  //     mentionsPositions: [0, 5, 22],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithMentions);

  // /**
  //  * Example 3: A cast with mentions and an attachment
  //  *
  //  * "Hey @dwr, check this out!"
  //  */
  // const castWithMentionsAndAttachment = await makeCastAdd(
  //   {
  //     text: "Hey , check this out!",
  //     embeds: [{ url: "https://farcaster.xyz" }],
  //     embedsDeprecated: [],
  //     mentions: [3],
  //     mentionsPositions: [4],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithMentionsAndAttachment);

  // /**
  //  * Example 4: A cast with mentions and an attachment, and a link in the text
  //  *
  //  * "Hey @dwr, check out https://farcaster.xyz!"
  //  */
  // const castWithMentionsAttachmentLink = await makeCastAdd(
  //   {
  //     text: "Hey , check out https://farcaster.xyz!",
  //     embeds: [{ url: "https://farcaster.xyz" }],
  //     embedsDeprecated: [],
  //     mentions: [3],
  //     mentionsPositions: [4],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithMentionsAttachmentLink);

  // /**
  //  * Example 5: A cast with multiple mentions
  //  *
  //  * "You can mention @v multiple times: @v @v @v"
  //  */

  // const castWithMultipleMentions = await makeCastAdd(
  //   {
  //     text: "You can mention  multiple times:   ",
  //     embeds: [],
  //     embedsDeprecated: [],
  //     mentions: [2, 2, 2, 2],
  //     mentionsPositions: [16, 33, 34, 35],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithMultipleMentions);

  // /**
  //  * Example 6: A cast with emoji and mentions
  //  *
  //  * "🤓@farcaster can mention immediately after emoji"
  //  */
  // const castWithEmojiAndMentions = await makeCastAdd(
  //   {
  //     text: "🤓 can mention immediately after emoji",
  //     embeds: [],
  //     embedsDeprecated: [],
  //     mentions: [1],
  //     mentionsPositions: [4],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithEmojiAndMentions);

  // /**
  //  * Example 7: A cast with emoji and a link in the text and an attachment
  //  *
  //  * "🤓https://url-after-unicode.com can include URL immediately after emoji"
  //  */

  // const castWithEmojiLinkAttachmnent = await makeCastAdd(
  //   {
  //     text: "🤓https://url-after-unicode.com can include URL immediately after emoji",
  //     embeds: [{ url: "https://url-after-unicode.com" }],
  //     embedsDeprecated: [],
  //     mentions: [],
  //     mentionsPositions: [],
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castWithEmojiLinkAttachmnent);

  // /**
  //  * Example 7: A cast that replies to a URL
  //  *
  //  * "I think this is a great protocol 🚀"
  //  */

  // const castReplyingToAUrl = await makeCastAdd(
  //   {
  //     text: "I think this is a great protocol 🚀",
  //     embeds: [],
  //     embedsDeprecated: [],
  //     mentions: [],
  //     mentionsPositions: [],
  //     parentUrl: "https://www.farcaster.xyz/",
  //   },
  //   dataOptions,
  //   ed25519Signer,
  // );
  // castResults.push(castReplyingToAUrl);
