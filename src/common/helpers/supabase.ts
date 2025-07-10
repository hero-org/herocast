import isEmpty from 'lodash.isempty';
import { AccountStatusType } from '../constants/accounts';
import { Customer, InsertCustomer } from '../types/database.types';

export const getAccountsForUser = async (supabaseClient) => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no account to hydrate');
    return [];
  }

  const { data: accountData, error: accountError } = await supabaseClient
    .from('decrypted_accounts')
    .select('*, accounts_to_channel(*, channel(*))')
    .eq('user_id', user?.id)
    .neq('status', AccountStatusType.removed)
    .order('display_order', { ascending: true, nullsLast: true })
    .order('created_at', { ascending: true });

  if (accountError) {
    console.error('error fetching accounts', accountError);
    return [];
  }
  return accountData;
};

export const getCustomersForUser = async (supabaseClient): Promise<Customer | undefined> => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no customer to hydrate');
    return undefined;
  }

  const { data: customerData, error: customerError } = await supabaseClient
    .from('customers')
    .select('*')
    .eq('user_id', user?.id)
    .maybeSingle();

  if (customerError) {
    console.error('error fetching customers', customerError);
    return undefined;
  }
  return customerData;
};

// this is a temporary hack until we integrate with Stripe webhooks
export const addUnsafeCustomerForUser = async (
  supabaseClient,
  customer: Omit<InsertCustomer, 'user_id'>
): Promise<boolean> => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (isEmpty(user)) {
    console.log('no user to add customer to');
    return false;
  }

  const { error } = await supabaseClient
    .from('customers')
    .insert({
      ...customer,
      user_id: user?.id,
    })
    .single();

  if (error) {
    console.error('error adding customer', error);
    return false;
  }
  return true;
};

export const updateAccountDisplayOrder = async (supabaseClient, accountId: string, displayOrder: number) => {
  const { error } = await supabaseClient.from('accounts').update({ display_order: displayOrder }).eq('id', accountId);

  if (error) {
    console.error('error updating account display order', error);
    return false;
  }
  return true;
};
