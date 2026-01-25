import { type Draft, create as mutativeCreate } from 'mutative';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createClient } from '@/common/helpers/supabase/component';
import type { Json } from '@/common/types/database.types';
import type { PanelConfig, PanelConfigUnion, PanelType, WorkspaceLayout } from '@/common/types/workspace.types';
import { IndexedDBStorage } from './StoreStorage';

const MAX_PANELS = 5;

/**
 * Default layout: Single trending feed panel at 100%
 */
const createDefaultLayout = (): WorkspaceLayout => ({
  panels: [
    {
      id: crypto.randomUUID(),
      type: 'feed',
      config: { feedType: 'trending' },
      collapsed: false,
    },
  ],
  panelSizes: [100],
  updatedAt: new Date().toISOString(),
});

interface WorkspaceState {
  layout: WorkspaceLayout;
  isHydrated: boolean;
  isSyncing: boolean;
}

interface WorkspaceActions {
  hydrate: () => Promise<void>;
  addPanel: (type: PanelType, config: PanelConfigUnion) => void;
  removePanel: (id: string) => void;
  reorderPanels: (oldIndex: number, newIndex: number) => void;
  updatePanelSizes: (sizes: number[]) => void;
  toggleCollapse: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
  syncToSupabase: () => Promise<void>;
  resetStore: () => void;
}

export interface WorkspaceStore extends WorkspaceState, WorkspaceActions {}

// Mutative helper for zustand (untyped to match existing store patterns)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutative = (config: any) => (set: any, get: any) => config((fn: any) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<WorkspaceStore>) => void) => void;

// Lazily initialize Supabase client to avoid issues during SSR/testing
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;
const getSupabaseClient = () => {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient();
  }
  return supabaseClientInstance;
};

/**
 * Recalculate panel sizes to distribute evenly
 */
const recalculateSizes = (panelCount: number): number[] => {
  if (panelCount === 0) return [];
  const evenSize = Math.floor(100 / panelCount);
  const sizes = Array(panelCount).fill(evenSize);
  // Distribute remainder to first panels
  const remainder = 100 - evenSize * panelCount;
  for (let i = 0; i < remainder; i++) {
    sizes[i] += 1;
  }
  return sizes;
};

/**
 * Sync workspace layout to Supabase user_preferences table
 */
const syncLayoutToSupabase = async (layout: WorkspaceLayout): Promise<void> => {
  try {
    const {
      data: { user },
    } = await getSupabaseClient().auth.getUser();

    if (!user) {
      console.log('[WorkspaceStore] No authenticated user, skipping Supabase sync');
      return;
    }

    const { error } = await getSupabaseClient()
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          preferences: { workspace: layout } as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[WorkspaceStore] Failed to sync to Supabase:', error);
    } else {
      console.log('[WorkspaceStore] Synced to Supabase successfully');
    }
  } catch (err) {
    console.error('[WorkspaceStore] Error syncing to Supabase:', err);
  }
};

/**
 * Fetch workspace layout from Supabase
 */
const fetchLayoutFromSupabase = async (): Promise<WorkspaceLayout | null> => {
  try {
    const {
      data: { user },
    } = await getSupabaseClient().auth.getUser();

    if (!user) {
      console.log('[WorkspaceStore] No authenticated user, skipping Supabase fetch');
      return null;
    }

    const { data, error } = await getSupabaseClient()
      .from('user_preferences')
      .select('preferences, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - user hasn't saved preferences yet
        console.log('[WorkspaceStore] No preferences found in Supabase');
        return null;
      }
      console.error('[WorkspaceStore] Failed to fetch from Supabase:', error);
      return null;
    }

    const preferences = data?.preferences as { workspace?: WorkspaceLayout } | null;
    return preferences?.workspace || null;
  } catch (err) {
    console.error('[WorkspaceStore] Error fetching from Supabase:', err);
    return null;
  }
};

const initialState: WorkspaceState = {
  layout: createDefaultLayout(),
  isHydrated: false,
  isSyncing: false,
};

const store = (set: StoreSet, get: () => WorkspaceStore) => ({
  ...initialState,

  hydrate: async () => {
    if (get().isHydrated) return;

    console.log('[WorkspaceStore] Hydrating...');

    // Local state is already loaded from IndexedDB via persist middleware
    const localLayout = get().layout;

    // Fetch from Supabase in background
    const remoteLayout = await fetchLayoutFromSupabase();

    if (remoteLayout) {
      // Compare timestamps - if Supabase is newer, use it
      const localTime = new Date(localLayout.updatedAt).getTime();
      const remoteTime = new Date(remoteLayout.updatedAt).getTime();

      if (remoteTime > localTime) {
        console.log('[WorkspaceStore] Remote layout is newer, using it');
        set((state) => {
          state.layout = remoteLayout;
          state.isHydrated = true;
        });
        return;
      }
    }

    set((state) => {
      state.isHydrated = true;
    });

    console.log('[WorkspaceStore] Hydration complete');
  },

  addPanel: (type: PanelType, config: PanelConfigUnion) => {
    set((state) => {
      if (state.layout.panels.length >= MAX_PANELS) {
        console.log('[WorkspaceStore] Max panels reached');
        return;
      }

      const newPanel: PanelConfig = {
        id: crypto.randomUUID(),
        type,
        config,
        collapsed: false,
      };

      state.layout.panels.push(newPanel);
      state.layout.panelSizes = recalculateSizes(state.layout.panels.length);
      state.layout.updatedAt = new Date().toISOString();
    });

    // Trigger debounced sync
    debouncedSyncToSupabase();
  },

  removePanel: (id: string) => {
    set((state) => {
      const idx = state.layout.panels.findIndex((p) => p.id === id);
      if (idx === -1) return;

      state.layout.panels.splice(idx, 1);
      state.layout.panelSizes = recalculateSizes(state.layout.panels.length);
      state.layout.updatedAt = new Date().toISOString();
    });

    debouncedSyncToSupabase();
  },

  reorderPanels: (oldIndex: number, newIndex: number) => {
    set((state) => {
      const panels = state.layout.panels;
      if (oldIndex < 0 || oldIndex >= panels.length || newIndex < 0 || newIndex >= panels.length) {
        return;
      }

      const [movedPanel] = panels.splice(oldIndex, 1);
      panels.splice(newIndex, 0, movedPanel);

      // Also reorder sizes to match
      const sizes = state.layout.panelSizes;
      const [movedSize] = sizes.splice(oldIndex, 1);
      sizes.splice(newIndex, 0, movedSize);

      state.layout.updatedAt = new Date().toISOString();
    });

    debouncedSyncToSupabase();
  },

  updatePanelSizes: (sizes: number[]) => {
    set((state) => {
      if (sizes.length !== state.layout.panels.length) {
        console.warn('[WorkspaceStore] Size array length mismatch');
        return;
      }

      state.layout.panelSizes = sizes;
      state.layout.updatedAt = new Date().toISOString();
    });

    debouncedSyncToSupabase();
  },

  toggleCollapse: (id: string) => {
    set((state) => {
      const panel = state.layout.panels.find((p) => p.id === id);
      if (panel) {
        panel.collapsed = !panel.collapsed;
        state.layout.updatedAt = new Date().toISOString();
      }
    });

    debouncedSyncToSupabase();
  },

  setCollapsed: (id: string, collapsed: boolean) => {
    set((state) => {
      const panel = state.layout.panels.find((p) => p.id === id);
      if (panel && panel.collapsed !== collapsed) {
        panel.collapsed = collapsed;
        state.layout.updatedAt = new Date().toISOString();
      }
    });

    debouncedSyncToSupabase();
  },

  syncToSupabase: async () => {
    const state = get();
    if (state.isSyncing) return;

    set((draft) => {
      draft.isSyncing = true;
    });

    try {
      await syncLayoutToSupabase(state.layout);
    } finally {
      set((draft) => {
        draft.isSyncing = false;
      });
    }
  },

  resetStore: () => {
    set((state) => {
      state.layout = createDefaultLayout();
      state.isHydrated = false;
      state.isSyncing = false;
    });
  },
});

const storage = new IndexedDBStorage('herocast-workspace-store');

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(mutative(store), {
    name: 'herocast-workspace-store',
    storage: createJSONStorage(() => storage),
    partialize: (state) => ({
      layout: state.layout,
    }),
  })
);

// Debounced sync function (500ms)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
export const debouncedSyncToSupabase = () => {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    useWorkspaceStore.getState().syncToSupabase();
  }, 500);
};

// Set up window blur/beforeunload listener for sync on close
if (typeof window !== 'undefined') {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Use sendBeacon or sync immediately when tab becomes hidden
      const state = useWorkspaceStore.getState();
      if (!state.isSyncing && state.isHydrated) {
        state.syncToSupabase();
      }
    }
  };

  const handleBeforeUnload = () => {
    // Clear any pending debounced sync and sync immediately
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    const state = useWorkspaceStore.getState();
    if (state.isHydrated) {
      // Note: This is best-effort since we can't await in beforeunload
      state.syncToSupabase();
    }
  };

  // Add listeners only in browser environment
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
}
