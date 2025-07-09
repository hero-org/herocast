import { NextApiRequest, NextApiResponse } from 'next';
import createClient from '@/common/helpers/supabase/api';
import { DirectCastAPI, DirectCastAPIError } from '@/common/helpers/directCastApi';

export const config = { maxDuration: 20 };

const TIMEOUT_THRESHOLD = 19000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, cursor, limit = 25, category } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'Missing accountId' });
  }

  // Create authenticated Supabase client
  const supabase = createClient(req, res);

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[DMs API Debug] Auth check:', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    error: userError,
  });
  
  if (userError || !user) {
    console.error('[DMs API Debug] Auth failed:', userError);
    return res.status(401).json({ error: 'Unauthorized', conversations: [], groups: [] });
  }

  // Verify user owns this account and get API key
  console.log('[DMs API Debug] Querying decrypted_dm_accounts for:', {
    accountId,
    userId: user.id,
  });
  
  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  console.log('[DMs API Debug] Query result:', {
    hasAccount: !!account,
    hasApiKey: !!account?.decrypted_farcaster_api_key,
    error: error,
  });

  if (error || !account?.decrypted_farcaster_api_key) {
    console.error('[DMs API Debug] Failed to get API key:', error);
    return res.status(403).json({ error: 'Unauthorized or API key not found' });
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: 'Request timeout', conversations: [], groups: [] });
  }, TIMEOUT_THRESHOLD);

  try {
    console.log('[DMs API Debug] Creating DirectCast API client with key:', {
      keyLength: account.decrypted_farcaster_api_key?.length,
      keyPrefix: account.decrypted_farcaster_api_key?.substring(0, 10) + '...',
    });
    
    const api = new DirectCastAPI({ apiKey: account.decrypted_farcaster_api_key });
    
    // Fetch both conversations and groups in parallel
    const [conversationsRes, groupsRes] = await Promise.all([
      api.getConversationList({
        cursor: cursor as string,
        limit: Number(limit),
        category: category as 'default' | 'request' | 'archived',
      }),
      api.getGroupList({
        cursor: cursor as string,
        limit: Number(limit),
        category: category as 'default' | 'request' | 'archived',
      }),
    ]);

    clearTimeout(timeout);

    res.status(200).json({
      conversations: conversationsRes.result?.conversations || [],
      groups: groupsRes.result?.groups || [],
      nextCursor: conversationsRes.next?.cursor || groupsRes.next?.cursor,
    });
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof DirectCastAPIError) {
      console.error('[DMs API Debug] DirectCast API error details:', {
        message: error.message,
        statusCode: error.statusCode,
        fullError: error,
      });
      return res.status(error.statusCode || 500).json({ 
        error: error.message,
        conversations: [],
        groups: [],
      });
    }

    console.error('[DMs API Debug] Unknown error fetching DMs:', error);
    res.status(500).json({ error: 'Failed to fetch messages', conversations: [], groups: [] });
  }
}