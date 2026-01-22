import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Audit logging for signing operations.
 * Best-effort logging - failures don't break signing operations.
 */

export interface AuditLogParams {
  supabaseClient: SupabaseClient;
  accountId: string;
  userId: string;
  action: string;
  success: boolean;
  errorCode?: string;
}

/**
 * Log a signing action to the audit log table.
 * This is a best-effort operation - it should never throw or break the signing flow.
 *
 * @param params - Audit log parameters
 * @param params.supabaseClient - Supabase client instance
 * @param params.accountId - The account ID that was used for signing
 * @param params.userId - The user ID who initiated the action
 * @param params.action - The action type (e.g., 'cast', 'like', 'recast', 'follow', 'unfollow', 'remove_cast')
 * @param params.success - Whether the operation succeeded
 * @param params.errorCode - Error code if the operation failed (optional)
 */
export async function logSigningAction(params: AuditLogParams): Promise<void> {
  const { supabaseClient, accountId, userId, action, success, errorCode } = params;

  try {
    const { error } = await supabaseClient
      .from('signing_audit_log')
      .insert({
        account_id: accountId,
        user_id: userId,
        action,
        success,
        error_code: errorCode ?? null,
      });

    if (error) {
      // Log to console but don't throw - audit is best-effort
      console.error('[audit] Failed to log signing action:', error.message, {
        accountId,
        userId,
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
      action,
      success,
      errorCode,
    });
  }
}
