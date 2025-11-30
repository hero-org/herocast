import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { openDB } from 'idb';
import { create as mutativeCreate, Draft } from 'mutative';
import { createClient } from '@/common/helpers/supabase/component';
import debounce from 'lodash.debounce';

const IDB_DATABASE_NAME = 'herocast-notifications';
const IDB_STORE_NAME = 'notification-read-states';
const IDB_VERSION = 1;
const SYNC_INTERVAL = 5000; // 5 seconds

// Memory management constants
const MAX_READ_STATES = 1000; // Maximum number of read states to keep
const MAX_SYNC_QUEUE = 1000; // Maximum sync queue size
const READ_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Mutative middleware
const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

const supabaseClient = createClient();

interface NotificationReadState {
  notificationId: string;
  readAt: number;
  type: string;
}

interface NotificationStore {
  readStates: Record<string, NotificationReadState>;
  lastReadTimestamp: Record<string, number>;
  isHydrated: boolean;
  syncQueue: NotificationReadState[]; // Queue for pending syncs
  lastSyncAt: number;

  // Actions
  markAsRead: (notificationId: string, type: string) => void;
  markAsUnread: (notificationId: string) => void;
  markAllAsRead: (type: string, notificationIds: string[]) => void;
  isRead: (notificationId: string) => boolean;
  getUnreadCount: (type: string, allIds: string[]) => number;
  hydrate: () => Promise<void>;
  syncToSupabase: () => Promise<void>;
  cleanup: () => void;
}

// Create or get the database connection
const getDB = async () => {
  // Check if we're in the browser environment
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available');
  }

  return openDB(IDB_DATABASE_NAME, IDB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    },
  });
};

const storage = createJSONStorage<NotificationStore>(() => ({
  getItem: async (name: string) => {
    try {
      // Return null during SSR
      if (typeof window === 'undefined' || !window.indexedDB) {
        return null;
      }
      const db = await getDB();
      const value = await db.get(IDB_STORE_NAME, name);
      return value || null;
    } catch (error) {
      console.error('Error getting from IndexedDB:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      // Skip during SSR
      if (typeof window === 'undefined' || !window.indexedDB) {
        return;
      }
      const db = await getDB();
      await db.put(IDB_STORE_NAME, value, name);
    } catch (error) {
      console.error('Error setting to IndexedDB:', error);
    }
  },
  removeItem: async (name: string) => {
    try {
      // Skip during SSR
      if (typeof window === 'undefined' || !window.indexedDB) {
        return;
      }
      const db = await getDB();
      await db.delete(IDB_STORE_NAME, name);
    } catch (error) {
      console.error('Error removing from IndexedDB:', error);
    }
  },
}));

type StoreSet = (fn: (draft: Draft<NotificationStore>) => void) => void;

// Debounced sync function
const debouncedSync = debounce(() => {
  useNotificationStore.getState().syncToSupabase();
}, SYNC_INTERVAL);

// Sync on page unload/navigation
if (typeof window !== 'undefined') {
  // Modern browsers - more reliable
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const state = useNotificationStore.getState();
      if (state.syncQueue.length > 0) {
        console.log('Page hidden, syncing notifications...');
        // Use sendBeacon for reliability during page unload
        navigator.sendBeacon && state.syncToSupabase();
      }
    }
  });

  // Fallback for older browsers
  window.addEventListener('beforeunload', () => {
    const state = useNotificationStore.getState();
    if (state.syncQueue.length > 0) {
      console.log('Page unloading, attempting sync...');
      state.syncToSupabase();
    }
  });
}

const store = (set: StoreSet, get) => ({
  readStates: {},
  lastReadTimestamp: {},
  isHydrated: false,
  syncQueue: [],
  lastSyncAt: 0,

  markAsRead: (notificationId: string, type: string) => {
    set((state) => {
      const readState = {
        notificationId,
        readAt: Date.now(),
        type,
      };
      state.readStates[notificationId] = readState;
      state.lastReadTimestamp[type] = Date.now();

      // Add to sync queue
      state.syncQueue.push(readState);
    });

    // Cleanup if exceeding thresholds
    const state = get();
    if (Object.keys(state.readStates).length > MAX_READ_STATES || state.syncQueue.length > MAX_SYNC_QUEUE) {
      get().cleanup();
    }

    // Trigger debounced sync
    debouncedSync();
  },

  markAsUnread: (notificationId: string) => {
    set((state) => {
      delete state.readStates[notificationId];
    });
  },

  markAllAsRead: (type: string, notificationIds: string[]) => {
    set((state) => {
      const now = Date.now();
      notificationIds.forEach((id) => {
        const readState = {
          notificationId: id,
          readAt: now,
          type,
        };
        state.readStates[id] = readState;
        state.syncQueue.push(readState);
      });
      state.lastReadTimestamp[type] = now;
    });

    // Cleanup if exceeding thresholds
    const state = get();
    if (Object.keys(state.readStates).length > MAX_READ_STATES || state.syncQueue.length > MAX_SYNC_QUEUE) {
      get().cleanup();
    }

    // Trigger debounced sync
    debouncedSync();
  },

  isRead: (notificationId: string) => {
    const state = get();
    return !!state.readStates[notificationId];
  },

  getUnreadCount: (type: string, allIds: string[]) => {
    const state = get();
    return allIds.filter((id) => !state.readStates[id]).length;
  },

  hydrate: async () => {
    try {
      // Fetch read states from Supabase
      const { data, error } = await supabaseClient
        .from('notification_read_states')
        .select('notification_id, notification_type, read_at')
        .order('read_at', { ascending: false });

      if (!error && data) {
        set((state) => {
          // Merge Supabase data with local data, preferring newer timestamps
          data.forEach((item) => {
            const localState = state.readStates[item.notification_id];
            const remoteReadAt = new Date(item.read_at).getTime();

            // If no local state or remote is newer, use remote
            if (!localState || remoteReadAt > localState.readAt) {
              state.readStates[item.notification_id] = {
                notificationId: item.notification_id,
                readAt: remoteReadAt,
                type: item.notification_type,
              };
            }
          });

          state.isHydrated = true;
        });

        // Run cleanup after hydration to enforce bounds
        get().cleanup();
      } else {
        // If error or no data, just mark as hydrated
        set((state) => {
          state.isHydrated = true;
        });

        // Still run cleanup on local data
        get().cleanup();
      }
    } catch (error) {
      console.error('Error hydrating notification states:', error);
      set((state) => {
        state.isHydrated = true;
      });

      // Still run cleanup on local data
      get().cleanup();
    }
  },

  cleanup: () => {
    set((state) => {
      const now = Date.now();
      const cutoffTime = now - READ_STATE_TTL_MS;

      // Get all entries and filter by TTL
      const entries = Object.entries(state.readStates);
      const validEntries = entries.filter(([, value]) => value.readAt > cutoffTime);

      // If still over limit, keep only the most recent MAX_READ_STATES
      let entriesToKeep = validEntries;
      if (validEntries.length > MAX_READ_STATES) {
        entriesToKeep = validEntries.sort((a, b) => b[1].readAt - a[1].readAt).slice(0, MAX_READ_STATES);
      }

      // Rebuild readStates from filtered entries
      state.readStates = Object.fromEntries(entriesToKeep);

      // Cap syncQueue with FIFO removal (keep most recent)
      if (state.syncQueue.length > MAX_SYNC_QUEUE) {
        state.syncQueue = state.syncQueue.slice(-MAX_SYNC_QUEUE);
      }
    });
  },

  syncToSupabase: async () => {
    const state = get();
    if (state.syncQueue.length === 0) return;

    try {
      // Get current user
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping sync');
        return;
      }

      // Get unique items from sync queue
      const uniqueItems = state.syncQueue.reduce(
        (acc, item) => {
          acc[item.notificationId] = item;
          return acc;
        },
        {} as Record<string, NotificationReadState>
      );

      const items = Object.values(uniqueItems).map((item) => ({
        user_id: user.id,
        notification_id: item.notificationId,
        notification_type: item.type,
        read_at: new Date(item.readAt).toISOString(),
      }));

      console.log('Syncing to Supabase:', items.length, 'items');

      // Try sendBeacon first for page unload scenarios
      if (typeof navigator !== 'undefined' && navigator.sendBeacon && document.visibilityState === 'hidden') {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (session) {
          const payload = {
            items,
            access_token: session.access_token,
          };
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          const success = navigator.sendBeacon('/api/notifications/sync', blob);
          if (success) {
            console.log('Sync sent via beacon');
            set((state) => {
              state.syncQueue = [];
              state.lastSyncAt = Date.now();
            });
            return;
          }
        }
      }

      // Regular sync
      const { error } = await supabaseClient.from('notification_read_states').upsert(items, {
        onConflict: 'user_id,notification_id',
        ignoreDuplicates: false,
      });

      if (!error) {
        console.log('Sync successful!');
        // Clear sync queue on success
        set((state) => {
          state.syncQueue = [];
          state.lastSyncAt = Date.now();
        });
      } else {
        console.error('Error syncing to Supabase:', error);
      }
    } catch (error) {
      console.error('Error in syncToSupabase:', error);
    }
  },
});

export const useNotificationStore = create<NotificationStore>()(
  persist(mutative(store), {
    name: 'notification-store',
    storage,
    partialize: (state) => ({
      readStates: state.readStates,
      lastReadTimestamp: state.lastReadTimestamp,
      syncQueue: state.syncQueue,
      lastSyncAt: state.lastSyncAt,
    }),
  })
);
