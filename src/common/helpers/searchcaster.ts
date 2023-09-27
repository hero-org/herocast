
const SEARCHASTER_API_ENDPOINT = 'https://searchcaster.xyz/api/'

export const searchForText = async (text: string): Promise<SearchResultCast[]> => {
  const response = await fetch(`${SEARCHASTER_API_ENDPOINT}search?count=10&text=${text}`)
  const json = await response.json()
  return json?.casts || []
}


export type SearchResultCast = {
  body: {
    publishedAt: number;
    username: string;
    data: {
      text: string;
      image: string;
      replyParentMerkleRoot: string;
      threadMerkleRoot: string;
    }
  }
  meta: {
    displayName: string;
    avatar: string;
    isVerifiedAvatar: boolean;
    numReplyChildren: number;
    reactions: {
      count: number;
      type: string;
    }
    recasts: {
      count: number;
    }
    watches: {
      count: number;
    }
    replyParentUsername: {
      fid: number;
      username: string;
    }
    mentions: {
      fid: number;
      pfp: {
        url: string;
        verified: boolean;
      }
      username: string;
      displayName: string;
    }[]
  }
  merkleRoot: string;
  uri: string;
}
