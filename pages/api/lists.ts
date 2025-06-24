import { NextApiRequest, NextApiResponse } from 'next';
import { FidListContent, isFidListContent } from '@/common/types/list.types';
import { Database } from '@/common/types/database.types';
import createClient from '@/common/helpers/supabase/api';

const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get query parameters
    const { listId, cursor, limit = 25, viewerFid } = req.query;

    if (!listId) {
      return res.status(400).json({ error: 'List ID is required' });
    }

    // Fetch list from database
    const supabase = createClient(req, res);
    const { data: list, error } = await supabase.from('list').select('*').eq('id', listId).single();

    if (error || !list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Ensure this is a FID list
    if (list.type !== 'fids' || !isFidListContent(list.contents)) {
      return res.status(400).json({ error: 'Not a valid FID list' });
    }

    const fidListContent = list.contents as FidListContent;
    // Ensure the list has FIDs
    if (!fidListContent.fids || fidListContent.fids.length === 0) {
      return res.status(200).json({
        casts: [],
        next: null,
      });
    }

    // Convert string FIDs to numbers
    const fids = fidListContent.fids.map((fid) => parseInt(fid, 10));
    console.log('fidListContent', fidListContent);
    console.log('fids', fids);
    // Fetch feed from Neynar API using fetch
    const limitValue = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    // Build URL with query parameters
    const url = new URL('https://api.neynar.com/v2/farcaster/feed');
    url.searchParams.append('feed_type', 'filter');
    url.searchParams.append('filter_type', 'fids');
    url.searchParams.append('fids', fids.join(','));
    url.searchParams.append('limit', limitValue.toString());

    if (cursor) {
      url.searchParams.append('cursor', cursor as string);
    }

    if (viewerFid) {
      url.searchParams.append('viewer_fid', viewerFid as string);
    }

    const options = {
      method: 'GET',
      headers: {
        'x-api-key': apiKey || '',
        Accept: 'application/json',
      },
    };

    const fetchResponse = await fetch(url.toString(), options);

    if (!fetchResponse.ok) {
      throw new Error(`Neynar API error: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }

    const response = await fetchResponse.json();

    // Return the feed data
    return res.status(200).json({
      casts: response.casts,
      next: response.next?.cursor,
    });
  } catch (error) {
    console.error('Error fetching list feed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
