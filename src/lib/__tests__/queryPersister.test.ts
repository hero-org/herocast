import { describe, expect, it, jest } from '@jest/globals';

// shouldPersistQuery is pure; stub the IndexedDB layer so importing the module
// never touches `idb`.
jest.mock('idb', () => ({ openDB: jest.fn() }));

import type { Query } from '@tanstack/react-query';
import { shouldPersistQuery } from '../queryPersister';

const makeQuery = (queryKey: unknown[], status: 'success' | 'pending' | 'error' = 'success') =>
  ({ queryKey, state: { status } }) as unknown as Query;

describe('shouldPersistQuery', () => {
  it('persists successful feed and profile queries', () => {
    expect(shouldPersistQuery(makeQuery(['feeds', 'following', '3', {}]))).toBe(true);
    expect(shouldPersistQuery(makeQuery(['feeds', 'trending', {}]))).toBe(true);
    expect(shouldPersistQuery(makeQuery(['profiles', 'byFid', 3, null]))).toBe(true);
  });

  it('does not persist other query roots', () => {
    expect(shouldPersistQuery(makeQuery(['search', 'casts', 'gm']))).toBe(false);
    expect(shouldPersistQuery(makeQuery(['analytics', 'casts', 3]))).toBe(false);
    expect(shouldPersistQuery(makeQuery(['casts', 'byHash', '0xabc']))).toBe(false);
    expect(shouldPersistQuery(makeQuery(['notifications', 3]))).toBe(false);
  });

  it('does not persist unsuccessful feed queries', () => {
    expect(shouldPersistQuery(makeQuery(['feeds', 'following', '3'], 'pending'))).toBe(false);
    expect(shouldPersistQuery(makeQuery(['feeds', 'following', '3'], 'error'))).toBe(false);
  });
});
