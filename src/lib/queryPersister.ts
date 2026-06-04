import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { type IDBPDatabase, openDB } from 'idb';
import debounce from 'lodash.debounce';

/**
 * IndexedDB-backed persister for the React Query cache.
 *
 * Restores the dehydrated cache on cold start so feeds/profiles paint from disk
 * instantly (stale-while-revalidate) instead of going blank while Neynar
 * refetches (7-8s). Mirrors the `idb` usage in `useNotificationStore`.
 */

const IDB_DATABASE_NAME = 'herocast-query-cache';
const IDB_STORE_NAME = 'query-cache';
const IDB_KEY = 'reactQuery';

// The subscribe layer calls persistClient on every cache event with no throttling
// of its own, so we coalesce bursts (infinite-scroll pages, optimistic updates)
// into at most one IndexedDB write per window.
const PERSIST_WRITE_DEBOUNCE_MS = 1000;

/** Persisted snapshots older than this are discarded on restore. */
export const QUERY_PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

/** Bump when the persisted cache shape changes, to invalidate old snapshots. */
export const QUERY_PERSIST_BUSTER = 'v1';

/** Query-key roots we persist. Keep in sync with `queryKeys`. */
const PERSISTED_QUERY_ROOTS = new Set(['feeds', 'profiles']);

/**
 * Only persist successful feed/profile queries — feeds drive the cold-start
 * paint, profiles make revisits instant. Everything else (search, analytics,
 * casts, errors, pending) stays memory-only.
 */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && PERSISTED_QUERY_ROOTS.has(query.queryKey[0] as string);
}

// Memoized connection that resolves to null (never rejects) when IndexedDB is
// unavailable — SSR, private mode, or a partitioned mini-app iframe — so every
// persister call degrades cleanly to a no-op.
let dbPromise: Promise<IDBPDatabase | null> | undefined;

function getDB(): Promise<IDBPDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = openDB(IDB_DATABASE_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      },
    }).catch((error) => {
      console.error('[queryPersister] failed to open IndexedDB:', error);
      return null;
    });
  }
  return dbPromise;
}

/** Delete the persisted snapshot (e.g. on data-provider switch). */
export async function removePersistedQueryCache(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    await db.delete(IDB_STORE_NAME, IDB_KEY);
  } catch (error) {
    console.error('[queryPersister] failed to remove cache:', error);
  }
}

export function createIDBPersister(): Persister {
  // Stored as a structured clone (no JSON round-trip), which reads back faster
  // for large feed payloads on cold start.
  const writeClient = async (client: PersistedClient) => {
    const db = await getDB();
    if (!db) return;
    try {
      await db.put(IDB_STORE_NAME, client, IDB_KEY);
    } catch (error) {
      console.error('[queryPersister] failed to persist cache:', error);
      // A full store would otherwise throw on every write — drop the snapshot to
      // recover; the next write repopulates it.
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        await removePersistedQueryCache();
      }
    }
  };
  const debouncedWrite = debounce(writeClient, PERSIST_WRITE_DEBOUNCE_MS);

  return {
    persistClient: (client) => {
      debouncedWrite(client);
    },
    restoreClient: async () => {
      const db = await getDB();
      if (!db) return undefined;
      try {
        return (await db.get(IDB_STORE_NAME, IDB_KEY)) as PersistedClient | undefined;
      } catch (error) {
        console.error('[queryPersister] failed to restore cache:', error);
        return undefined;
      }
    },
    removeClient: async () => {
      // Cancel any queued write so a stale snapshot can't resurrect after removal.
      debouncedWrite.cancel();
      await removePersistedQueryCache();
    },
  };
}
