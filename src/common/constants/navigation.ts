import { IconType } from "react-icons";
import { FiHome, FiTrendingUp, FiCompass, FiStar, FiSettings } from "react-icons/fi";
import { GiMatterStates } from "react-icons/gi";

interface LinkItemProps {
  name: string;
  to?: string;
  icon: IconType;
}

export const SidebarLinkItems: Array<LinkItemProps> = [
  { name: 'Welcome', to: '/', icon: FiHome },
  { name: 'Tauri', to: '/tauri', icon: FiCompass },
  { name: 'Zustand', to: "/zustand", icon: GiMatterStates },
];

export const enum RIGHT_SIDEBAR_ENUM {
  ACCOUNTS = 'accounts',
  CHANNELS = 'channels',
}

export const enum MAIN_NAVIGATION_ENUM {
  ADD_ACCOUNT = 'add-account',
  FEED = 'feed',
  REPLIES = 'replies',
  NEW_POST = 'new-post',
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
  [MAIN_NAVIGATION_ENUM.ADD_ACCOUNT]: {
    title: 'Add Account',
    rightSidebar: RIGHT_SIDEBAR_ENUM.ACCOUNTS,
  },
  [MAIN_NAVIGATION_ENUM.FEED]: {
    title: 'Feed',
    rightSidebar: RIGHT_SIDEBAR_ENUM.CHANNELS,
  },
  [MAIN_NAVIGATION_ENUM.REPLIES]: {
    title: 'Replies',
    rightSidebar: null,
  },
  [MAIN_NAVIGATION_ENUM.NEW_POST]: {
    title: 'New Post',
    rightSidebar: RIGHT_SIDEBAR_ENUM.CHANNELS,
  },
  [MAIN_NAVIGATION_ENUM.SETTINGS]: {
    title: 'Settings',
    rightSidebar: null,
  },
}
