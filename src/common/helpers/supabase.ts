import { createClient } from '@supabase/supabase-js'
import isEmpty from 'lodash.isempty';
import { AccountStatusType, DraftStatusType } from '../constants/accounts';

// export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// const options = {
//   auth: {
//     autoRefreshToken: true,
//     persistSession: true,
//   },
// }

export const getAccountsForUser = async (supabaseClient) => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no account to hydrate');
    return [];
  }

  const { data: accountData, error: accountError } = await supabaseClient
    .from('decrypted_accounts')
    .select('*, accounts_to_channel(*, channel(*)), draft(*)')
    .eq('user_id', user?.id)
    .in('draft.status', [DraftStatusType.writing, DraftStatusType.scheduled, DraftStatusType.published])
    .neq('status', AccountStatusType.removed)
    .order('created_at', { ascending: true });

  if (accountError) {
    console.error('error fetching accounts', accountError);
    return [];
  }

  return accountData;
}
