import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 20, // Max duration for the API route
};

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/casts';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for cast lookups (5 minute TTL)
const castCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (casts: string, viewerFid?: string) => `${casts}:${viewerFid || 'no-viewer'}`;

const getCachedData = (key: string) => {
  const cached = castCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    castCache.delete(key); // Remove expired cache
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  castCache.set(key, { data, timestamp: Date.now() });
  
  // Clean up old cache entries periodically (keep cache size reasonable)
  if (castCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of castCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        castCache.delete(k);
      }
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { casts, viewerFid } = req.query;

  // Validate the casts parameter
  if (!casts || typeof casts !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid casts parameter' });
  }

  // Check cache first
  const cacheKey = getCacheKey(casts, viewerFid as string);
  const cachedResult = getCachedData(cacheKey);
  
  if (cachedResult) {
    console.log(`Cache hit for cast: ${casts.substring(0, 10)}...`);
    return res.status(200).json(cachedResult);
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: TIMEOUT_ERROR_MESSAGE, result: { casts: [] }, isTimeout: true });
  }, timeoutThreshold);

  try {
    // Constructing the Neynar API URL with query parameters
    let apiUrl = `${NEYNAR_API_URL}?casts=${encodeURIComponent(casts)}`;
    
    if (viewerFid) {
      apiUrl += `&viewer_fid=${encodeURIComponent(viewerFid as string)}`;
    }

    console.log(`Cache miss - fetching cast from Neynar: ${casts.substring(0, 10)}...`);

    // Send GET request to Neynar API
    const response = await axios.get(apiUrl, {
      headers: {
        accept: 'application/json',
        api_key: API_KEY,
      },
      timeout: timeoutThreshold,
    });

    // Parse and return the results
    const { result } = response.data || {};
    const responseData = { 
      result: result || { casts: [] }
    };

    // Cache the result
    setCachedData(cacheKey, responseData);
    
    clearTimeout(timeout); // Clear the timeout if the request completes successfully

    res.status(200).json(responseData);
  } catch (error) {
    clearTimeout(timeout); // Clear the timeout in case of error
    if (axios.isAxiosError(error)) {
      console.error('Error during Neynar casts API request:', error.response?.data || error.message);
    } else {
      console.error('Error during Neynar casts API request:', error);
    }

    res.status(500).json({
      error: 'Failed to fetch casts',
      result: { casts: [] },
    });
  }
}