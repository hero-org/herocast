// Area C (unit #3) — wires the EXISTING window-guarded IndexedDB persister
// (@/lib/queryPersister) into the persistOptions that Area A passes to
// <PersistQueryClientProvider>. Do NOT reinvent the persister — this only
// assembles the reused pieces (conventions.md reuse contract).
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import { getProviderType } from '@/lib/farcaster/providers';
import {
  createIDBPersister,
  QUERY_PERSIST_BUSTER,
  QUERY_PERSIST_MAX_AGE,
  shouldPersistQuery,
} from '@/lib/queryPersister';

/** The exact shape `<PersistQueryClientProvider persistOptions={...}>` expects. */
type PersistOptions = PersistQueryClientProviderProps['persistOptions'];

/**
 * Build the persistOptions for the provider tree. Area A calls this ONCE from a
 * `useState(() => getPersistOptions())` initializer so the persister + buster stay
 * stable across renders.
 *
 * SSR-safe on workerd:
 *  - `createIDBPersister()` never touches IndexedDB at construction — its internal
 *    `getDB()` lazily no-ops when `window`/`indexedDB` are absent, so calling this
 *    during the SSR render is safe.
 *  - `getProviderType()` self-guards (returns the `'neynar'` default when
 *    `typeof window === 'undefined'`), so the provider-scoped buster never reads
 *    `localStorage` on the server. conventions.md LANDMINE #1 is therefore handled
 *    at the source; Area A's useState initializer needs no extra guard for this.
 */
export function getPersistOptions(): PersistOptions {
  return {
    persister: createIDBPersister(),
    maxAge: QUERY_PERSIST_MAX_AGE,
    // Scope the snapshot to the active data provider so a stale provider's cache is
    // discarded on the next cold start (matches the live app/providers.tsx buster).
    buster: `${QUERY_PERSIST_BUSTER}-${getProviderType()}`,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}
