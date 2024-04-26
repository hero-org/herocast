import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";

const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

type getUserDataForFidOrUsernameProps = {
  username?: string;
  fid?: number;
  viewerFid: number;
};

export const getUserDataForFidOrUsername = async ({ username, fid, viewerFid }: getUserDataForFidOrUsernameProps): Promise<User[]> => {
  try {
    let users: User[] = [];
    if (username) {
      const resp = await neynarClient.searchUser(username, viewerFid);
      users = resp?.result?.users;
    } else if (fid) {
      const resp = await neynarClient.fetchBulkUsers([fid], { viewerFid });
      users = resp?.users;
    }
    return users;
  } catch (err) {
    console.error("error user data for fid or username", fid, username, err);
    return [];
  }
}