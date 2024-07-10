/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export enum CastModalView {
  New = "new",
  Reply = "reply",
  Quote = "quote",
}

interface NavigationStoreProps {
  castModalDraftId?: string;
  isNewCastModalOpen: boolean;
  castModalView: CastModalView;
  isCommandPaletteOpen: boolean;
}

interface NavigationStoreActions {
  setCastModalDraftId: (draftId: number) => void;
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
  castModalDraftId: undefined,
  castModalView: CastModalView.New,
  setCastModalDraftId: (draftId: number) => {
    set((state) => {
      state.castModalDraftId = draftId;
    });
  },
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
