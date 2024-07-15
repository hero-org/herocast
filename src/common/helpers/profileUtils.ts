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
  const { addUserProfile } = useDataStore.getState();
  const users = await getUserDataForFidOrUsername({
    username,
    fid,
    viewerFid,
  });
  if (users.length) {
    users.forEach((user) => {
      addUserProfile({ user });
    });
  }
  return users;
};
