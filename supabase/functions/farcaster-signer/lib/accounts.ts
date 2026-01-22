import { SupabaseClient } from '@supabase/supabase-js';
import { SigningAccount } from './types.ts';
import { ErrorCodes, SignerServiceError } from './errors.ts';

/**
 * Retrieves an account for signing operations.
 *
 * Queries the decrypted_accounts view which automatically handles
 * private key decryption. RLS is enforced via the authenticated
 * Supabase client (user's JWT), ensuring users can only access
 * their own accounts.
 *
 * @param supabaseClient - Authenticated Supabase client with user's JWT
 * @param accountId - UUID of the account to retrieve
 * @param userId - User ID for additional verification (optional for service-role calls)
 * @returns SigningAccount containing fid, privateKey, and userId
 * @throws SignerServiceError if account not found or not active
 */
export async function getAccountForSigning(
  supabaseClient: SupabaseClient,
  accountId: string,
  userId?: string
): Promise<SigningAccount> {
  let query = supabaseClient
    .from('decrypted_accounts')
    .select('id, platform_account_id, decrypted_private_key, status, user_id')
    .eq('id', accountId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: accounts, error } = await query;

  if (error) {
    console.error('Error fetching account:', error);
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, `Failed to fetch account: ${error.message}`, 404);
  }

  if (!accounts || accounts.length === 0) {
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account not found', 404);
  }

  const account = accounts[0];

  // Check if account is active (not pending or other status)
  if (account.status !== 'active') {
    throw new SignerServiceError(
      ErrorCodes.ACCOUNT_PENDING,
      `Account is not active (current status: ${account.status})`,
      400 // Per spec: ACCOUNT_PENDING returns 400
    );
  }

  // Validate that we have the required data
  if (!account.platform_account_id) {
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account has no FID', 404);
  }

  if (!account.decrypted_private_key) {
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account has no private key', 404);
  }

  if (!account.user_id) {
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account has no user', 404);
  }

  return {
    fid: Number(account.platform_account_id),
    privateKey: account.decrypted_private_key,
    userId: account.user_id,
  };
}
