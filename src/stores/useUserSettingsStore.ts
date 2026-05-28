import { type Draft, create as mutativeCreate } from 'mutative';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { patchUserPreferences, readUserPreferences } from './userPreferencesSync';

export type ProviderType = 'neynar' | 'hypersnap';

const LOCAL_STORAGE_KEY = 'farcaster-provider';

const isProviderType = (value: unknown): value is ProviderType => value === 'neynar' || value === 'hypersnap';

interface UserSettingsState {
  farcasterProvider: ProviderType;
  isHydrated: boolean;
}

interface UserSettingsActions {
  hydrate: () => Promise<void>;
  setFarcasterProvider: (type: ProviderType) => Promise<void>;
}

export interface UserSettingsStore extends UserSettingsState, UserSettingsActions {}

// Mutative helper for zustand (untyped to match existing store patterns).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutative = (config: any) => (set: any, get: any) => config((fn: any) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<UserSettingsStore>) => void) => void;

const readInitialFarcasterProvider = (): ProviderType => {
  if (typeof window === 'undefined') return 'neynar';
  const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  return isProviderType(cached) ? cached : 'neynar';
};

const initialState: UserSettingsState = {
  farcasterProvider: readInitialFarcasterProvider(),
  isHydrated: false,
};

const store = (set: StoreSet) => ({
  ...initialState,

  hydrate: async () => {
    try {
      // 1. Fast path: read from localStorage for instant first paint.
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (isProviderType(cached)) {
          set((state) => {
            state.farcasterProvider = cached;
          });
        }
      }

      // 2. Authoritative read from Supabase.
      const prefs = await readUserPreferences();
      const remote = prefs?.farcasterProvider;

      if (isProviderType(remote)) {
        set((state) => {
          state.farcasterProvider = remote;
        });

        // Keep localStorage in sync with the server-side source of truth.
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
          if (cached !== remote) {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, remote);
          }
        }
      }
    } catch (err) {
      console.error('[UserSettingsStore] hydrate failed:', err);
    } finally {
      set((state) => {
        state.isHydrated = true;
      });
    }
  },

  setFarcasterProvider: async (type: ProviderType) => {
    // 1. Optimistic local update.
    set((state) => {
      state.farcasterProvider = type;
    });

    // 2. Persist to localStorage immediately for next-session continuity.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, type);
    }

    // 3. Best-effort sync to Supabase (helper handles errors internally).
    await patchUserPreferences({ farcasterProvider: type });
  },
});

export const useUserSettingsStore = create<UserSettingsStore>()(devtools(mutative(store)));
