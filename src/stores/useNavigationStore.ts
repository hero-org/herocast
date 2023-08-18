import { MAIN_NAVIGATION_ENUM } from "@/common/constants/navigation";
import { CommandType } from "@/common/constants/commands";
import { Bars3BottomLeftIcon, ChatBubbleBottomCenterTextIcon } from "@heroicons/react/20/solid";
import { Cog6ToothIcon, HashtagIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { redirect, useNavigate } from "react-router-dom";

interface NavigationStoreProps {
  mainNavigation: MAIN_NAVIGATION_ENUM;
  isCommandPaletteOpen: boolean;
}

interface NavigationStoreActions {
  toggleCommandPalette: () => void;
  toAccounts: () => void;
  toFeed: () => void;
  toReplies: () => void;
  toNewPost: () => void;
  toSettings: () => void;
}

export interface NavigationStore extends NavigationStoreProps, NavigationStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NavigationStore>) => void) => void;

const store = (set: StoreSet) => ({
  mainNavigation: MAIN_NAVIGATION_ENUM.FEED,
  isCommandPaletteOpen: false,
  toggleCommandPalette: () => {
    set((state) => {
      state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
    });
  },
  toAccounts: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.ACCOUNTS;
      redirect(`/${MAIN_NAVIGATION_ENUM.ACCOUNTS}`)
    });
  },
  toFeed: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.FEED;
      redirect(`/${MAIN_NAVIGATION_ENUM.FEED}`)
    });
  },
  // toNewPost: () => {
  //   set((state) => {
  //     state.mainNavigation = MAIN_NAVIGATION_ENUM.NEW_POST;
  //   });
  // },
  // toReplies: () => {
  //   set((state) => {
  //     state.mainNavigation = MAIN_NAVIGATION_ENUM.REPLIES;
  //   });
  // },
  toSettings: () => {
    set((state) => {
      console.log('useNavStore: toSettings')
      state.mainNavigation = MAIN_NAVIGATION_ENUM.SETTINGS;
    });
  },
});
export const useNavigationStore = create<NavigationStore>()(devtools(mutative(store)));

export const navigationCommands: CommandType[] = [
  {
    name: 'Accounts',
    aliases: ['new account', 'sign up'],
    icon: UserPlusIcon,
    shortcut: 'cmd+shift+a',
    enableOnFormTags: true,
    action: () => useNavigationStore.getState().toAccounts(),
  },
  {
    name: 'Switch to Feed',
    aliases: ['scroll',],
    icon: Bars3BottomLeftIcon,
    shortcut: 'shift+f',
    enableOnFormTags: true,
    action: () => useNavigationStore.getState().toFeed(),
  },
  // {
  //   name: 'Switch to Replies.',
  //   aliases: ['threads',],
  //   icon: ChatBubbleBottomCenterTextIcon,
  //   shortcut: 'shift+r',
  //   enableOnFormTags: true,
  //   action: () => useNavigationStore.getState().toReplies(),
  // },
  // {
  //   name: 'Switch to new post',
  //   aliases: ['new tweet', 'write', 'create', 'compose',],
  //   icon: HashtagIcon,
  //   shortcut: 'cmd+n',
  //   enableOnFormTags: true,
  //   action: () => useNavigationStore.getState().toNewPost(),
  // },
  {
    name: 'Settings',
    aliases: ['preferences', 'options', 'config',],
    icon: Cog6ToothIcon,
    shortcut: 'cmd+,',
    enableOnFormTags: true,
    action: () => useNavigationStore.getState().toSettings(),
  },
]
