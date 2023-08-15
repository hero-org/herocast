export const enum RIGHT_SIDEBAR_ENUM {
  ACCOUNTS = 'accounts',
  CHANNELS = 'channels',
  CHANNELS_AND_ACCOUNTS = 'channels-and-accounts',
}

export const enum MAIN_NAVIGATION_ENUM {
  ACCOUNTS = 'accounts',
  FEED = 'feed',
  // REPLIES = 'replies',
  // NEW_POST = 'new-post',
  SETTINGS = 'settings',
}

type NavigationPage = {
  title: string;
  rightSidebar: RIGHT_SIDEBAR_ENUM | null;
}

type MainNavigationToPage = {
  [key in MAIN_NAVIGATION_ENUM]: NavigationPage;
}

export const MAIN_NAVIGATION_TO_PAGE: MainNavigationToPage = {
  [MAIN_NAVIGATION_ENUM.ACCOUNTS]: {
    title: 'Accounts',
    rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
  },
  [MAIN_NAVIGATION_ENUM.FEED]: {
    title: 'Feed',
    rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
  },
  // [MAIN_NAVIGATION_ENUM.REPLIES]: {
  //   title: 'Replies',
  //   rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
  // },
  // [MAIN_NAVIGATION_ENUM.NEW_POST]: {
  //   title: 'New Post',
  //   rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
  // },
  [MAIN_NAVIGATION_ENUM.SETTINGS]: {
    title: 'Settings',
    rightSidebar: null,
  },
}
