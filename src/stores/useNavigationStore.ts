/* eslint-disable @typescript-eslint/no-unsafe-call */
import { UUID } from 'crypto';
import { Draft, create as mutativeCreate } from 'mutative';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export enum CastModalView {
  New = 'new',
  Reply = 'reply',
  Quote = 'quote',
}

interface NavigationStoreProps {
  castModalDraftId?: UUID;
  isNewCastModalOpen: boolean;
  castModalView: CastModalView;
  isCommandPaletteOpen: boolean;
  isManageListModalOpen: boolean;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
}

interface NavigationStoreActions {
  setCastModalDraftId: (draftId: UUID) => void;
  setCastModalView: (view: CastModalView) => void;
  setIsManageListModalOpen: (isOpen: boolean) => void;
  openNewCastModal: () => void;
  closeNewCastModal: () => void;
  closeCommandPallete: () => void;
  toggleCommandPalette: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  initializeSidebarState: () => void;
}

export interface NavigationStore extends NavigationStoreProps, NavigationStoreActions {}

export const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<NavigationStore>) => void) => void;

// Sidebar state localStorage helpers
const SIDEBAR_STATE_KEY = 'herocast-sidebar-state';

interface SidebarState {
  left: boolean;
  right: boolean;
}

const loadSidebarState = (): SidebarState => {
  if (typeof window === 'undefined') {
    return { left: true, right: true };
  }

  try {
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (stored) {
      return JSON.parse(stored) as SidebarState;
    }
  } catch (error) {
    console.error('Failed to load sidebar state:', error);
  }

  return { left: true, right: true };
};

const saveSidebarState = (left: boolean, right: boolean): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({ left, right }));
  } catch (error) {
    console.error('Failed to save sidebar state:', error);
  }
};

const store = (set: StoreSet) => ({
  isCommandPaletteOpen: false,
  isNewCastModalOpen: false,
  castModalDraftId: undefined,
  castModalView: CastModalView.New,
  isManageListModalOpen: false,
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  setCastModalDraftId: (draftId: UUID) => {
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
  setIsManageListModalOpen: (isOpen: boolean) => {
    set((state) => {
      state.isManageListModalOpen = isOpen;
    });
  },
  setLeftSidebarOpen: (open: boolean) => {
    set((state) => {
      state.leftSidebarOpen = open;
      saveSidebarState(open, state.rightSidebarOpen);
    });
  },
  setRightSidebarOpen: (open: boolean) => {
    set((state) => {
      state.rightSidebarOpen = open;
      saveSidebarState(state.leftSidebarOpen, open);
    });
  },
  toggleLeftSidebar: () => {
    set((state) => {
      state.leftSidebarOpen = !state.leftSidebarOpen;
      saveSidebarState(state.leftSidebarOpen, state.rightSidebarOpen);
    });
  },
  toggleRightSidebar: () => {
    set((state) => {
      state.rightSidebarOpen = !state.rightSidebarOpen;
      saveSidebarState(state.leftSidebarOpen, state.rightSidebarOpen);
    });
  },
  initializeSidebarState: () => {
    const savedState = loadSidebarState();
    set((state) => {
      state.leftSidebarOpen = savedState.left;
      state.rightSidebarOpen = savedState.right;
    });
  },
});
export const useNavigationStore = create<NavigationStore>()(devtools(mutative(store)));
