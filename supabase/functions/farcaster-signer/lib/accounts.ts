import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorCodes, SignerServiceError } from './errors.ts';
import type { SigningAccount } from './types.ts';

/**
 * Retrieves an account for signing operations.
 *
 * Invokes the `decrypted_account` SECURITY DEFINER RPC, which self-filters by
 * `auth.uid()` and returns the decrypted private key only when the authenticated
 * user owns the account. The per-caller JWT (either a real user JWT or a cron-
 * minted short-lived JWT whose `sub` is the validated owner) is the trust
 * boundary — no extra `.eq('user_id', userId)` filter is needed.
 *
 * @param supabaseClient - Authenticated Supabase client with user's JWT
 * @param accountId - UUID of the account to retrieve
 * @param userId - Authenticated user ID. Used for defense-in-depth: after the RPC
 *                 returns, we assert `account.user_id === userId` so that any
 *                 future loosening of the RPC's `auth.uid()` filter still fails
 *                 closed here at the application layer.
 * @returns SigningAccount containing fid, privateKey, and userId
 * @throws SignerServiceError if account not found or not active
 */
export async function getAccountForSigning(
  supabaseClient: SupabaseClient,
  accountId: string,
  userId: string
): Promise<SigningAccount> {
  // The RPC is SECURITY DEFINER and self-filters on `auth.uid() = user_id`.
  // That is the canonical trust boundary. We still re-check ownership below
  // as defense-in-depth: if the RPC ever drifted (e.g. loosened filter), the
  // caller's JWT `sub` must still match the row's `user_id`.

  const { data: accounts, error } = await supabaseClient.rpc('decrypted_account', {
    account_id: accountId,
  });

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

  // Defense-in-depth: the RPC should already self-filter by `auth.uid()`, but
  // verify the returned row's `user_id` matches the caller's JWT `sub` so a
  // regression in the RPC filter can't leak a key across tenants. Use the
  // ACCOUNT_NOT_FOUND code to avoid leaking account existence.
  if (account.user_id !== userId) {
    throw new SignerServiceError(ErrorCodes.ACCOUNT_NOT_FOUND, 'Account not found', 404);
  }

  return {
    fid: Number(account.platform_account_id),
    privateKey: account.decrypted_private_key,
    userId: account.user_id,
  };
}
