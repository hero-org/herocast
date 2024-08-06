import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";

type GetUserDataForFidOrUsernameProps = {
  username?: string;
  fid?: number;
  viewerFid: number;
};

export const getUserDataForFidOrUsername = async ({ username, fid, viewerFid }: GetUserDataForFidOrUsernameProps): Promise<User[]> => {
  try {
    if (!username && !fid) {
      return [];
    }

    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    if (username) {
      const resp = await neynarClient.searchUser(username, viewerFid);
      return resp?.result?.users || [];
    } else if (fid) {
      const resp = await neynarClient.fetchBulkUsers([fid], { viewerFid });
      return resp?.users || [];
    }

    return [];
  } catch (err) {
    console.error("Error fetching user data for fid or username", { fid, username, err });
    return [];
  }
};
