import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Audit logging for signing operations.
 * Best-effort logging - failures don't break signing operations.
 *
 * Writes run as service_role (not as the caller's user JWT) because
 * `signing_audit_log` has `FORCE ROW LEVEL SECURITY` and no user-INSERT
 * policy: the audit table is intentionally append-only from the signer.
 * A dedicated privileged client is constructed here so handlers keep using
 * the user-scoped client for everything else.
 */

export interface AuditLogParams {
  supabaseClient: SupabaseClient;
  accountId: string;
  /**
   * The account owner's user id (matches `accounts.user_id`). Kept as-is for
   * backward compatibility with existing audit rows.
   */
  userId: string;
  /**
   * The actor who initiated the action (from the caller JWT `sub`). For user
   * traffic this equals `userId`; for cron traffic it's the owner whose behalf
   * the cron is acting on — the value is still meaningful for audit since the
   * `source` column disambiguates.
   */
  actorUserId: string;
  /**
   * Request origin tag: 'user' | 'cron:publish' | 'cron:auto-interaction' | 'system'.
   */
  source: string;
  action: string;
  success: boolean;
  errorCode?: string;
}

let cachedPrivilegedClient: SupabaseClient | null = null;

/**
 * Lazily construct a service-role Supabase client. Cached across calls within
 * the same edge-function invocation to avoid re-parsing env vars per log row.
 */
function getPrivilegedClient(): SupabaseClient {
  if (cachedPrivilegedClient) return cachedPrivilegedClient;
  const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('API_URL') || Deno.env.get('SUPABASE_API_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or service_role key for audit writes');
  }
  cachedPrivilegedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedPrivilegedClient;
}

/**
 * Log a signing action to the audit log table.
 * This is a best-effort operation - it should never throw or break the signing flow.
 *
 * @param params - Audit log parameters
 * @param params.supabaseClient - Supabase client instance (unused for the
 *   INSERT itself; kept in the signature so handlers don't need refactoring).
 * @param params.accountId - The account ID that was used for signing
 * @param params.userId - The account owner's user id
 * @param params.actorUserId - The caller who initiated the action (JWT `sub`)
 * @param params.source - Request origin tag (user/cron:*)
 * @param params.action - The action type (e.g., 'cast', 'like', 'recast', 'follow', 'unfollow', 'remove_cast')
 * @param params.success - Whether the operation succeeded
 * @param params.errorCode - Error code if the operation failed (optional)
 */
export async function logSigningAction(params: AuditLogParams): Promise<void> {
  const { accountId, userId, actorUserId, source, action, success, errorCode } = params;

  try {
    const client = getPrivilegedClient();
    const { error } = await client.from('signing_audit_log').insert({
      account_id: accountId,
      user_id: userId,
      actor_user_id: actorUserId,
      source,
      action,
      success,
      error_code: errorCode ?? null,
    });

    if (error) {
      // Log to console but don't throw - audit is best-effort
      console.error('[audit] Failed to log signing action:', error.message, {
        accountId,
        userId,
        actorUserId,
        source,
        action,
        success,
        errorCode,
      });
    }
  } catch (err) {
    // Catch any unexpected errors and log them, but don't rethrow
    console.error('[audit] Unexpected error logging signing action:', err, {
      accountId,
      userId,
      actorUserId,
      source,
      action,
      success,
      errorCode,
    });
  }
}
