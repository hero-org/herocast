import { getUserDataForFidOrUsername } from "./neynar";
import { useDataStore } from "@/stores/useDataStore";

export const fetchAndAddUserProfile = async ({
  username,
  fid,
  viewerFid,
}: {
  username?: string;
  fid?: number;
  viewerFid: number;
}) => {
  const users = await getUserDataForFidOrUsername({
    username,
    fid,
    viewerFid,
  });
  console.log('fetchUserProfiles', username, users)
  const { addUserProfile } = useDataStore.getState();
  if (users.length) {
    users.forEach((user) => {
      addUserProfile({ user });
    });
  }
  return users;
};
