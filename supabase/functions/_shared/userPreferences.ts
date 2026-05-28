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
 * Cross-function helper. Lives in `_shared/` because each Supabase edge
 * function has its own Deno module graph and cannot import from a sibling
 * function's `lib/`.
 *
 * `supabaseClient` is intentionally typed `any`: matching the real Supabase
 * client structurally is awkward (`.maybeSingle()` returns a `PostgrestBuilder`
 * thenable, not a `Promise`), and importing the typed `SupabaseClient` from
 * `@supabase/supabase-js` here forces us to pick a Deno import specifier
 * (`npm:`, bare, `https://esm.sh/`) that may not match each caller's import
 * map. Each caller passes their own typed client; the query shape is locally
 * validated by the chain below.
 */
// biome-ignore lint/suspicious/noExplicitAny: see docstring above
export async function getUserFarcasterProvider(supabaseClient: any, userId: string): Promise<HubProvider> {
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
