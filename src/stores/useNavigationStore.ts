/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// UPDATE REPLY MODAL:
// it's not about a reply, it's about a new cast
// it can have a parent -> then it's a reply
// it can have an embed -> then it's a quote

export enum CastModalView {
  New = "new",
  Reply = "reply",
  Quote = "quote",
}

interface NavigationStoreProps {
  isNewCastModalOpen: boolean;
  castModalView: CastModalView;
  isCommandPaletteOpen: boolean;
}

interface NavigationStoreActions {
  setCastModalView: (view: CastModalView) => void;
  openNewCastModal: () => void;
  closeNewCastModal: () => void;
  closeCommandPallete: () => void;
  toggleCommandPalette: () => void;
}

export interface NavigationStore extends NavigationStoreProps, NavigationStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NavigationStore>) => void) => void;

const store = (set: StoreSet) => ({
  isCommandPaletteOpen: false,
  isNewCastModalOpen: false,
  castModalView: "new",
  setCastModalView: (view: CastModalView) => {
    set((state) => {
      state.castModalView = view;
    });
  },
  openNewCastModal: () => {
    set((state) => {
      state.isNewCastModalOpen = true;
    });
  },
  closeNewCastModal: () => {
    set((state) => {
      state.isNewCastModalOpen = false;
    });
  },
  closeCommandPallete: () => {
    set((state) => {
      state.isCommandPaletteOpen = false;
    });
  },
  toggleCommandPalette: () => {
    set((state) => {
      state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
    });
  },
});
export const useNavigationStore = create<NavigationStore>()(devtools(mutative(store)));
