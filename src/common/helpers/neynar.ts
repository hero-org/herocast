import axios from "axios";
import { CastType } from "../constants/farcaster";

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

type NotificationsEndpointProps = {
  fid: string | number;
  cursor?: string;
  limit?: number;
}

export type CasterType = {
  fid: number
  username?: string
  display_name?: string

}
export const DEFAULT_FEED_PAGE_SIZE = 15;

const VITE_NEYNAR_API_KEY = import.meta.env.VITE_NEYNAR_API_KEY;
const NEYNAR_API_URL = 'https://api.neynar.com';

export const getNeynarFeedEndpoint = ({ fid, parentUrl, cursor, limit }: FeedEndpointProps): string => {
  let neynarEndpoint = `${NEYNAR_API_URL}/v2/farcaster/feed/?api_key=${VITE_NEYNAR_API_KEY}&limit=${limit || DEFAULT_FEED_PAGE_SIZE}`;

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
  let neynarEndpoint = `${NEYNAR_API_URL}/v1/farcaster/all-casts-in-thread/?api_key=${VITE_NEYNAR_API_KEY}&threadHash=${castHash}`;

  if (fid) {
    neynarEndpoint += `&viewerFid=${fid}`;
  }

  return neynarEndpoint;
}

export const getNeynarNotificationsEndpoint = ({ fid, cursor, limit }: NotificationsEndpointProps): string => {
  let neynarEndpoint = `${NEYNAR_API_URL}/v1/farcaster/mentions-and-replies/?fid=${fid}&api_key=${VITE_NEYNAR_API_KEY}&limit=${limit || DEFAULT_FEED_PAGE_SIZE}`;

  if (cursor) {
    neynarEndpoint += `&cursor=${cursor}`;
  }

  return neynarEndpoint;
}

// https://invented-crayfish-e70.notion.site/GET-v2-farcaster-user-search-744565be2d2444bcbcbb2748be437998
// needs search with: &q=${query} to work
export const getNeynarUserSearchEndpoint = (viewerFid?: string): string => {
  let neynarEndpoint = `${NEYNAR_API_URL}/v2/farcaster/user/search?api_key=${VITE_NEYNAR_API_KEY}`

  if (viewerFid) {
    neynarEndpoint += `&viewer_fid=${viewerFid}`
  }

  return neynarEndpoint;
}


export const fetchCasts = async (castHashes: { hash: string }[]): Promise<CastType[]> => {
  const url = `${NEYNAR_API_URL}/v2/farcaster/casts`;
  const headers = {
    'api_key': VITE_NEYNAR_API_KEY,
    'Content-Type': 'application/json'
  };

  return await axios.get(url, { headers, data: JSON.stringify({ casts: castHashes }) })
    .then(response => {
      console.log(response.data);
      return response.data.casts;
    })
    .catch(error => {
      console.error(error);
      return [];
    });
}
