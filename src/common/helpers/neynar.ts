import { VITE_NEYNAR_API_KEY } from "@/common/constants/farcaster";

const DEFAULT_FEED_PAGE_SIZE = 15;

type FeedEndpointProps = {
  fid?: string;
  parentUrl?: string;
  cursor?: string;
  limit?: number;
};

type CastThreadEndpointProps = {
  castHash: string;
  fid?: string;
}


export const getNeynarFeedEndpoint = ({ fid, parentUrl, cursor, limit }: FeedEndpointProps): string => {
  let neynarEndpoint = `https://api.neynar.com/v2/farcaster/feed/?api_key=${VITE_NEYNAR_API_KEY}&limit=${limit || DEFAULT_FEED_PAGE_SIZE}`;

  if (parentUrl) {
    neynarEndpoint += `&feed_type=filter&filter_type=parent_url&parent_url=${parentUrl}`;
  } else if (fid) {
    neynarEndpoint += `&fid=${fid}`;
  }

  if (cursor) {
    neynarEndpoint += `&cursor=${cursor}`;
  }

  return neynarEndpoint;
}

export const getNeynarCastThreadEndpoint = ({ castHash, fid }: CastThreadEndpointProps): string => {
  let neynarEndpoint = `https://api.neynar.com/v1/farcaster/all-casts-in-thread/?api_key=${VITE_NEYNAR_API_KEY}&threadHash=${castHash}`;

  if (fid) {
    neynarEndpoint += `&viewerFid=${fid}`;
  }

  return neynarEndpoint;
}
