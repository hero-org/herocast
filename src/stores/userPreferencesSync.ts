import { createClient } from '@/common/helpers/supabase/component';
import type { Json } from '@/common/types/database.types';

// Lazily initialize Supabase client to avoid issues during SSR/testing.
// Matches the pattern used in src/stores/useWorkspaceStore.ts.
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;
const getSupabaseClient = () => {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient();
  }
  return supabaseClientInstance;
};

/**
 * Read the full preferences JSONB for the authenticated user.
 * Returns null if no row or no user.
 */
export async function readUserPreferences(): Promise<Record<string, Json> | null> {
  try {
    const {
      data: { user },
    } = await getSupabaseClient().auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await getSupabaseClient()
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found — user hasn't saved preferences yet.
        return null;
      }
      console.error('[userPreferencesSync] Failed to read user_preferences:', error);
      return null;
    }

    return (data?.preferences as Record<string, Json> | null) ?? null;
  } catch (err) {
    console.error('[userPreferencesSync] Error reading user_preferences:', err);
    return null;
  }
}

/**
 * Read-merge-write patch. Reads existing preferences, shallow-merges with `patch`,
 * writes back via upsert. Races with other writers are accepted (debounce on call sites).
 */
export async function patchUserPreferences(patch: Record<string, Json>): Promise<void> {
  try {
    const {
      data: { user },
    } = await getSupabaseClient().auth.getUser();

    if (!user) {
      return;
    }

    const current = await readUserPreferences();
    const next: Record<string, Json> = { ...(current ?? {}), ...patch };

    const { error } = await getSupabaseClient()
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          preferences: next as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[userPreferencesSync] Failed to patch user_preferences:', error);
    }
  } catch (err) {
    console.error('[userPreferencesSync] Error patching user_preferences:', err);
  }
}
