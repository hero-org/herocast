import { NextApiRequest, NextApiResponse } from 'next';
import createClient from '@/common/helpers/supabase/api';
import { DirectCastAPI, DirectCastAPIError } from '@/common/helpers/directCastApi';
import { DIRECT_CAST_API } from '@/common/constants/directCast';

export const config = { maxDuration: 20 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, conversationId, groupId, cursor, limit = 25 } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'Missing accountId' });
  }

  if (!conversationId && !groupId) {
    return res.status(400).json({ error: 'Either conversationId or groupId is required' });
  }

  // Create authenticated Supabase client
  const supabase = createClient(req, res);

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized', messages: [] });
  }

  // Verify user owns this account and get API key
  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (error || !account?.decrypted_farcaster_api_key) {
    return res.status(403).json({ error: 'Unauthorized or API key not found' });
  }

  const timeout = setTimeout(() => {
    res.status(503).json({ error: 'Request timeout', messages: [] });
  }, DIRECT_CAST_API.RATE_LIMITS.MESSAGES_PER_CONVERSATION_PER_MINUTE * 1000 - 1000);

  try {
    const api = new DirectCastAPI({ apiKey: account.decrypted_farcaster_api_key });
    
    const response = await api.getMessageList({
      conversationId: conversationId as string,
      groupId: groupId as string,
      cursor: cursor as string,
      limit: Number(limit),
    });

    clearTimeout(timeout);

    res.status(200).json({
      messages: response.result?.messages || [],
      nextCursor: response.next?.cursor,
    });
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof DirectCastAPIError) {
      console.error('DirectCast API error:', error.message);
      return res.status(error.statusCode || 500).json({ 
        error: error.message,
        messages: [],
      });
    }

    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages', messages: [] });
  }
}