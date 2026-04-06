import { create, keyResolver, windowScheduler } from '@yornaath/batshit';
import { getProvider } from '@/lib/farcaster/providers';
import type { ProfileData } from './useProfile';

/**
 * Profile request batcher using batshit.
 *
 * Collects individual profile fetch requests within a 10ms window
 * and batches them into a single API call. This solves the N+1 query
 * problem when rendering feeds where each CastRow fetches profile data.
 *
 * @see https://tanstack.com/query/v4/docs/framework/react/community/batching-requests-using-bathshit
 */
export const profileBatcher = create<ProfileData[], number, ProfileData>({
  fetcher: async (fids: number[]) => {
    return getProvider().getBulkUsers(fids);
  },
  resolver: keyResolver('fid'),
  scheduler: windowScheduler(10), // 10ms batching window
});
