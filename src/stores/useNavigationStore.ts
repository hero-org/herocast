import create, { State } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { MAIN_NAVIGATION_ENUM } from "@/common/constants/navigation";

interface NavigationStoreProps {
  mainNavigation: MAIN_NAVIGATION_ENUM;
  isCommandPaletteOpen: boolean;
}

interface NavigationStoreActions {
  toggleCommandPalette: () => void;
  toAddAccount: () => void;
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
  toAddAccount: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.ADD_ACCOUNT;
    });
  },
  toFeed: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.FEED;
    });
  },
  toNewPost: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.NEW_POST;
    });
  },
  toReplies: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.REPLIES;
    });
  },
  toSettings: () => {
    set((state) => {
      state.mainNavigation = MAIN_NAVIGATION_ENUM.SETTINGS;
    });
  },
});
export const useNavigationStore = create<NavigationStore>()(devtools(mutative(store)));
