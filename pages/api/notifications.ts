import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 20, // Max duration for the API route
};

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/notifications';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fid, cursor, type, priorityMode = false, limit = 25 } = req.query;

  // Validate the FID
  if (!fid || typeof fid !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid FID parameter' });
  }

  // Validate and cap the limit according to Neynar's constraints (max 25)
  // Neynar API enforces a maximum limit of 25 for notifications endpoint
  const validatedLimit = Math.min(parseInt(limit as string) || 25, 25);

  const timeout = setTimeout(() => {
    res.status(503).json({ error: TIMEOUT_ERROR_MESSAGE, notifications: [], isTimeout: true });
  }, timeoutThreshold);

  try {
    // Constructing the Neynar API URL with query parameters
    let apiUrl = `${NEYNAR_API_URL}?fid=${fid}&priority_mode=${priorityMode}&limit=${validatedLimit}`;

    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor as string)}`;
    }

    if (type) {
      apiUrl += `&type=${encodeURIComponent(type as string)}`;
    }

    console.log('Fetching notifications from Neynar API...');
    console.log('Request URL:', apiUrl);

    // Send GET request to Neynar API
    const response = await axios.get(apiUrl, {
      headers: {
        accept: 'application/json',
        api_key: API_KEY,
      },
      timeout: timeoutThreshold,
    });

    // Parse and return the results
    const { notifications = [], next } = response.data || {};
    clearTimeout(timeout); // Clear the timeout if the request completes successfully

    res.status(200).json({
      notifications,
      next,
      cursor: next?.cursor,
    });
  } catch (error) {
    clearTimeout(timeout); // Clear the timeout in case of error
    if (axios.isAxiosError(error)) {
      console.error('Error during Neynar notifications API request:', error.response?.data || error.message);
    } else {
      console.error('Error during Neynar notifications API request:', error);
    }

    res.status(500).json({
      error: 'Failed to fetch notifications',
      notifications: [],
    });
  }
}
