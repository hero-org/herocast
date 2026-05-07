import type { FarcasterCast, FarcasterUser } from '@/common/types/farcaster';

/**
 * Fetches a single cast by its hash via the internal lookup API.
 * Returns the cast object, or `null` if it cannot be found / on error.
 */
export const fetchCastByHash = async (hash: string): Promise<FarcasterCast | null> => {
  if (!hash) return null;

  try {
    const params = new URLSearchParams({ identifier: hash, type: 'hash' });
    const response = await fetch(`/api/casts/lookup?${params.toString()}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return (data?.cast as FarcasterCast) ?? null;
  } catch (err) {
    console.error('Error fetching cast by hash', { hash, err });
    return null;
  }
};

type GetUserDataForFidOrUsernameProps = {
  username?: string;
  fid?: string;
  viewerFid: string;
};

export const getUserDataForFidOrUsername = async ({
  username,
  fid,
  viewerFid,
}: GetUserDataForFidOrUsernameProps): Promise<FarcasterUser[]> => {
  try {
    if (!username && !fid) {
      return [];
    }

    if (username) {
      const params = new URLSearchParams({
        q: username,
        viewer_fid: viewerFid,
      });
      const response = await fetch(`/api/users/search?${params.toString()}`);
      if (!response.ok) {
        console.error('Failed to search users:', response.statusText);
        return [];
      }
      const data = await response.json();
      return data?.users || [];
    } else if (fid) {
      const params = new URLSearchParams({
        fids: fid,
        viewer_fid: viewerFid,
      });
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        console.error('Failed to fetch users:', response.statusText);
        return [];
      }
      const data = await response.json();
      return data?.users || [];
    }

    return [];
  } catch (err) {
    console.error('Error fetching user data for fid or username', {
      fid,
      username,
      err,
    });
    return [];
  }
};
