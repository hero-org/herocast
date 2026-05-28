/**
 * Read the user-level Farcaster Hub provider preference from
 * `user_preferences.preferences.farcasterProvider`.
 *
 * Lane A (already shipped) writes this value from the client-side
 * `useUserSettingsStore`. The signer reads it at PUBLISH time (not at
 * scheduling time — see Spike 3 §11 lock-in).
 *
 * Behavior:
 * - Returns 'neynar' as the safe default if the row is missing, the
 *   `preferences` jsonb is empty, the field is absent, or the value is not in
 *   the allowed set.
 * - Never throws. Read failures are logged and the function falls back to
 *   'neynar'.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HubProvider } from './hubs.ts';

export async function getUserFarcasterProvider(
  supabaseClient: SupabaseClient,
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
