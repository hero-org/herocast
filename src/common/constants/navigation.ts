export const enum RIGHT_SIDEBAR_ENUM {
  ACCOUNTS = 'accounts',
  CHANNELS = 'channels',
  ACCOUNTS_AND_CHANNELS = 'accounts_and_channels',
  NONE = 'none',
}

export const enum MAIN_NAVIGATION_ENUM {
  LOGIN = 'login',
  ACCOUNTS = 'accounts',
  FEED = 'feed',
  SEARCH = 'search',
  NEW_POST = 'post',
  SETTINGS = 'settings',
}

// type NavigationPage = {
//   title: string;
//   rightSidebar: RIGHT_SIDEBAR_ENUM | null;
// }

// type MainNavigationToPage = {
//   [key in MAIN_NAVIGATION_ENUM]: NavigationPage;
// }

// export const MAIN_NAVIGATION_TO_PAGE: MainNavigationToPage = {
//   [MAIN_NAVIGATION_ENUM.ACCOUNTS]: {
//     title: 'Accounts',
//     rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
//   },
//   [MAIN_NAVIGATION_ENUM.FEED]: {
//     title: 'Feed',
//     rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
//   },
//   [MAIN_NAVIGATION_ENUM.SEARCH]: {
//     title: 'Replies',
//     rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
//   },
//   [MAIN_NAVIGATION_ENUM.POST]: {
//     title: 'New Post',
//     rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
//   },
//   [MAIN_NAVIGATION_ENUM.SETTINGS]: {
//     title: 'Settings',
//     rightSidebar: null,
//   },
// }
