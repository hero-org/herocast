import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NavigationStoreProps {
  isCommandPaletteOpen: boolean;
}

interface NavigationStoreActions {
  closeCommandPallete: () => void;
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
  isCommandPaletteOpen: false,
  closeCommandPallete: () => {
    set((state) => {
      state.isCommandPaletteOpen = false;
    });
  },
  toggleCommandPalette: () => {
    set((state) => {
      console.log('useNavStore: toggleCommandPalette');
      state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
    });
  },
  // toAccounts: () => {
  //   set((state) => {
  //     console.log('useNavStore: toAccounts');
  //     // state.mainNavigation = MAIN_NAVIGATION_ENUM.ACCOUNTS;
  //     redirect(`/${MAIN_NAVIGATION_ENUM.ACCOUNTS}`)
  //   });
  // },
  // toFeed: () => {
  //   set((state) => {
  //     // state.mainNavigation = MAIN_NAVIGATION_ENUM.FEED;
  //     redirect(`/${MAIN_NAVIGATION_ENUM.FEED}`)
  //   });
  // },
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
  // toSettings: () => {
  //   set((state) => {
  //     console.log('useNavStore: toSettings')
  //     // state.mainNavigation = MAIN_NAVIGATION_ENUM.SETTINGS;
  //     redirect(`/${MAIN_NAVIGATION_ENUM.FEED}`)
  //   });
  // },
});
export const useNavigationStore = create<NavigationStore>()(devtools(mutative(store)));
