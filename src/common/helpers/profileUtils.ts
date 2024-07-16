import get from "lodash.get";
import { getUserDataForFidOrUsername } from "./neynar";
import { DataStore, useDataStore, UserProfile, PROFILE_UPDATE_INTERVAL } from "@/stores/useDataStore";

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
  const { addUserProfile } = useDataStore.getState();
  if (users.length) {
    users.forEach((user) => {
      addUserProfile({ user });
    });
  }
  return users;
};

export const getProfileFetchIfNeeded = async ({
  username,
  viewerFid
}: {
  username: string;
  viewerFid: number
}) => {
  let profile = getProfile(useDataStore.getState(), username);
  if (!profile) {
    username = username.startsWith("@") ? username.slice(1) : username;
    const results = await fetchAndAddUserProfile({
      username, viewerFid,
    });
    const matchingUsernames = [username, `${username}.eth`];
    profile = results.find((user) =>
      matchingUsernames.includes(user.username)
    );
  }
  return profile;
};

export const getProfile = (dataStoreState: DataStore, username?: string, fid?: string) => {
  if (username) {
    const usernameToFid = get(dataStoreState.usernameToFid, username) || get(dataStoreState.usernameToFid, `${username}.eth`);
    return get(dataStoreState.fidToData, usernameToFid);
  } else if (fid) {
    return get(dataStoreState.fidToData, fid);
  }
};

export const shouldUpdateProfile = (profile?: UserProfile) => {
  return !profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL;
};
