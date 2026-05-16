import type { FarcasterUser } from '@/common/types/farcaster';
import { getProvider } from '@/lib/farcaster/providers';

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
    if (!username && !fid) return [];
    const viewerFidNum = Number(viewerFid);
    if (username) {
      return await getProvider().searchUsers({ q: username, viewerFid: viewerFidNum });
    }
    if (fid) {
      return await getProvider().getBulkUsers({ fids: [Number(fid)], viewerFid: viewerFidNum });
    }
    return [];
  } catch (err) {
    console.error('Error fetching user data for fid or username', { fid, username, err });
    return [];
  }
};
