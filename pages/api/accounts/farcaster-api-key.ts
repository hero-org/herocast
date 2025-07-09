import { NextApiRequest, NextApiResponse } from 'next';
import createClient from '@/common/helpers/supabase/api';
import { UUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, apiKey } = req.body;

  if (!accountId || !apiKey) {
    return res.status(400).json({ error: 'Missing accountId or apiKey' });
  }

  if (!apiKey.startsWith('wc_secret_')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }

  const supabase = createClient(req, res);

  // Verify user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify user owns this account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId as UUID)
    .eq('user_id', user.id)
    .single();

  if (accountError || !account) {
    return res.status(403).json({ error: 'Account not found or unauthorized' });
  }

  // Update the farcaster_api_key (it will be encrypted automatically by the trigger)
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ farcaster_api_key: apiKey })
    .eq('id', accountId as UUID);

  if (updateError) {
    console.error('Error updating farcaster_api_key:', updateError);
    return res.status(500).json({ error: 'Failed to save API key' });
  }

  res.status(200).json({ success: true });
}