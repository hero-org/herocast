import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Idempotency handling for signing operations.
 * Prevents duplicate posts when clients retry requests.
 */

export interface IdempotencyCheckResult {
  found: boolean;
  hash?: string;
  error?: string;
}

/**
 * Check if a request with this idempotency key has already been processed.
 *
 * @param supabaseClient - Supabase client instance
 * @param accountId - The account ID for the request
 * @param idempotencyKey - The client-provided idempotency key
 * @returns Object indicating if found, and cached hash/error if available
 */
export async function checkIdempotency(
  supabaseClient: SupabaseClient,
  accountId: string,
  idempotencyKey: string
): Promise<IdempotencyCheckResult> {
  try {
    const { data, error } = await supabaseClient
      .from('signing_idempotency')
      .select('response_hash, response_error')
      .eq('idempotency_key', idempotencyKey)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[idempotency] Failed to check idempotency key:', error.message, {
        accountId,
        idempotencyKey,
      });
      // On error, treat as not found - allow the request to proceed
      return { found: false };
    }

    if (!data) {
      return { found: false };
    }

    return {
      found: true,
      hash: data.response_hash ?? undefined,
      error: data.response_error ?? undefined,
    };
  } catch (err) {
    console.error('[idempotency] Unexpected error checking idempotency key:', err, {
      accountId,
      idempotencyKey,
    });
    // On unexpected error, treat as not found - allow the request to proceed
    return { found: false };
  }
}

/**
 * Store the result of a request for future idempotency checks.
 * Uses upsert to handle race conditions where multiple requests
 * with the same key arrive simultaneously.
 *
 * @param supabaseClient - Supabase client instance
 * @param accountId - The account ID for the request
 * @param idempotencyKey - The client-provided idempotency key
 * @param hash - The cast hash if the operation succeeded (optional)
 * @param error - The error code if the operation failed (optional)
 */
export async function storeIdempotency(
  supabaseClient: SupabaseClient,
  accountId: string,
  idempotencyKey: string,
  hash?: string,
  error?: string
): Promise<void> {
  try {
    const { error: upsertError } = await supabaseClient
      .from('signing_idempotency')
      .upsert(
        {
          idempotency_key: idempotencyKey,
          account_id: accountId,
          response_hash: hash ?? null,
          response_error: error ?? null,
        },
        {
          onConflict: 'idempotency_key,account_id',
        }
      );

    if (upsertError) {
      // Log but don't throw - idempotency storage is best-effort
      // The operation already succeeded, we just can't cache it
      console.error('[idempotency] Failed to store idempotency result:', upsertError.message, {
        accountId,
        idempotencyKey,
        hash,
        error,
      });
    }
  } catch (err) {
    console.error('[idempotency] Unexpected error storing idempotency result:', err, {
      accountId,
      idempotencyKey,
      hash,
      error,
    });
  }
}
