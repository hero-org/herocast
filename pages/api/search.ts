import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 20, // Max duration for the API route
};

const timeoutThreshold = 19000; // 19 seconds timeout to ensure it completes within 20 seconds
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/cast/search';
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { term, limit = 10, offset = 0, priorityMode = false } = req.query;

  // Validate the search term
  if (typeof term !== 'string' || term.length < 3) {
    return res.status(400).json({ error: 'Invalid search term. Minimum 3 characters required.' });
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: TIMEOUT_ERROR_MESSAGE, results: [], isTimeout: true });
  }, timeoutThreshold);

  try {
    // Constructing the Neynar API URL with query parameters
    const apiUrl = `${NEYNAR_API_URL}?q=${encodeURIComponent(
      term
    )}&priority_mode=${priorityMode}&limit=${limit}&offset=${offset}`;

    console.log('Sending request to Neynar API...');
    console.log('Request URL:', apiUrl);

    // Send GET request to Neynar API
    const response = await axios.get(apiUrl, {
      headers: {
        accept: 'application/json',
        api_key: API_KEY,
      },
      timeout: timeoutThreshold,
    });

    // console.log('Response from Neynar API:', response.data);

    // Parse and return the results
    const results = response.data?.result?.casts || [];
    clearTimeout(timeout); // Clear the timeout if the request completes successfully

    res.status(200).json({ results });
  } catch (error) {
    clearTimeout(timeout); // Clear the timeout in case of error
    if (axios.isAxiosError(error)) {
      console.error('Error during Neynar API request:', error.response?.data || error.message);
    } else {
      console.error('Error during Neynar API request:', error);
    }

    res.status(500).json({
      error: 'Failed to fetch search results',
      results: [],
    });
  }
}
