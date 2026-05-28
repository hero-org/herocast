/**
 * Cross-function helper: read the user-level Farcaster Hub provider preference
 * from `user_preferences.preferences.farcasterProvider`.
 *
 * Lane A (already shipped) writes this value from the client-side
 * `useUserSettingsStore`. Server-side readers (signer service + cron publisher)
 * call this at PUBLISH time, not at scheduling time (Spike 3 §11 lock-in).
 *
 * Lives in `_shared/` because each Supabase edge function has its own Deno
 * module graph and cannot import from a sibling function's `lib/`. Keeping
 * one canonical implementation prevents drift between the signer and the cron.
 *
 * Behavior:
 * - Returns 'neynar' as the safe default if the row is missing, the
 *   `preferences` jsonb is empty, the field is absent, or the value is not in
 *   the allowed set.
 * - Never throws. Read failures are logged and the function falls back to
 *   'neynar'.
 */

export type HubProvider = 'neynar' | 'hypersnap';

/**
 * Minimal structural type matching both the signer's typed `SupabaseClient`
 * and the cron's service-role client. Avoids picking a specifier style
 * (`npm:`, bare, `https://esm.sh/`) in this `_shared/` file — each caller
 * passes their own typed client and the shape is locally validated.
 */
interface SupabaseLikeClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        value: string
      ): {
        maybeSingle(): Promise<{ data: { preferences?: unknown } | null; error: { message: string } | null }>;
      };
    };
  };
}

export async function getUserFarcasterProvider(
  supabaseClient: SupabaseLikeClient,
  userId: string
): Promise<HubProvider> {
  try {
    const { data, error } = await supabaseClient
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[userPreferences] read failed:', error.message);
      return 'neynar';
    }

    const prefs = data?.preferences as { farcasterProvider?: unknown } | null;
    const val = prefs?.farcasterProvider;
    return val === 'hypersnap' ? 'hypersnap' : 'neynar';
  } catch (err) {
    console.error('[userPreferences] unexpected error:', err);
    return 'neynar';
  }
}
