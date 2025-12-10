import { create, windowScheduler, keyResolver } from '@yornaath/batshit';
import { ProfileData } from './useProfile';

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
    const params = new URLSearchParams();
    params.append('fids', fids.join(','));
    // Use app FID as default viewer for viewer context
    params.append('viewer_fid', process.env.NEXT_PUBLIC_APP_FID || '');

    const response = await fetch(`/api/users?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch profiles');
    }

    const data = await response.json();
    return data.users || [];
  },
  resolver: keyResolver('fid'),
  scheduler: windowScheduler(10), // 10ms batching window
});
