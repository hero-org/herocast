import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';

type GetUserDataForFidOrUsernameProps = {
  username?: string;
  fid?: string;
  viewerFid: string;
};

export const getUserDataForFidOrUsername = async ({
  username,
  fid,
  viewerFid,
}: GetUserDataForFidOrUsernameProps): Promise<User[]> => {
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
