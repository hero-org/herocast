import get from 'lodash.get';
import { getUserDataForFidOrUsername } from './neynar';
import { DataStore, useDataStore, UserProfile, PROFILE_UPDATE_INTERVAL } from '@/stores/useDataStore';

export const fetchAndAddUserProfile = async ({
  username,
  fid,
  viewerFid,
}: {
  username?: string;
  fid?: string;
  viewerFid: string;
}) => {
  const users = await getUserDataForFidOrUsername({
    username,
    fid,
    viewerFid,
  });
  const { addUserProfile } = useDataStore.getState();
  if (users.length) {
    for (const user of users) {
      const response = await fetch(
        `/api/additionalProfileInfo?fid=${user.fid}&addresses=${user.verified_addresses.eth_addresses}`
      );
      if (response.ok) {
        const userProfileInfos = await response.json();
        const enrichedUser = {
          ...user,
          airstackSocialInfo: userProfileInfos.airstackSocialInfo,
          icebreakerSocialInfo: userProfileInfos.icebreakerSocialInfo,
        };
        addUserProfile({ user: enrichedUser });
      } else {
        console.error(`Failed to fetch assets for user with FID ${user.fid}`);
        addUserProfile({ user });
      }
    }
  }
  return users;
};

export const getProfileFetchIfNeeded = async ({
  username,
  fid,
  viewerFid,
}: {
  username?: string;
  viewerFid: string;
  fid?: string;
}) => {
  if (!username && !fid) {
    return;
  }

  let profile = getProfile(useDataStore.getState(), username, fid);
  if (!profile) {
    username = username && username.startsWith('@') ? username.slice(1) : username;
    const results = await fetchAndAddUserProfile({
      username,
      fid,
      viewerFid,
    });
    const matchingUsernames = [username, `${username}.eth`];
    profile = results.find((user) => matchingUsernames.includes(user.username));
  }
  return profile;
};

export const getProfile = (dataStoreState: DataStore, username?: string, fid?: string) => {
  if (username) {
    const usernameToFid =
      get(dataStoreState.usernameToFid, username) || get(dataStoreState.usernameToFid, `${username}.eth`);
    return get(dataStoreState.fidToData, usernameToFid);
  } else if (fid) {
    return get(dataStoreState.fidToData, fid);
  }
};

export const shouldUpdateProfile = (profile?: UserProfile) => {
  return !profile || profile?.updatedAt < Date.now() - PROFILE_UPDATE_INTERVAL;
};
