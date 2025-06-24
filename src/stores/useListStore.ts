import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { create as mutativeCreate, Draft } from 'mutative';
import { createClient } from '@/common/helpers/supabase/component';
import { InsertList, List, UpdateList } from '@/common/types/database.types';
import {
  FidListContent,
  isFidListContent,
  AutoInteractionListContent,
  isAutoInteractionListContent,
} from '@/common/types/list.types';
import { UUID } from 'crypto';

export type Search = {
  term: string;
  startedAt: number;
  endedAt: number;
  resultsCount: number;
};

// List content types moved to @/common/types/list.types.ts

type AddListType = Omit<InsertList, 'user_id'>;

interface ListStoreProps {
  searches: Search[];
  lists: List[];
  isHydrated: boolean;
  selectedListId?: UUID;
  currentSearchTerm?: string;
}

interface ListStoreActions {
  hydrate: () => void;
  addSearch: (search: Search) => void;
  addFidList: (name: string, fids: string[]) => void;
  updateList: (search: UpdateList) => void;
  updateFidList: (listId: UUID, name: string, fids: string[]) => void;
  addList: (newList: AddListType) => void;
  removeList: (listId: UUID) => void;
  setSelectedListId: (id?: UUID) => void;
  setCurrentSearchTerm: (term?: string) => void;

  // Helper methods
  getFidLists: () => List[];
  getSearchLists: () => List[];

  // FID list specific methods
  addFidToList: (listId: UUID, fid: string, displayName?: string) => Promise<void>;
  removeFidFromList: (listId: UUID, fid: string) => Promise<void>;
  updateFidDisplayName: (listId: UUID, fid: string, displayName: string) => Promise<void>;
  isFidInList: (listId: UUID, fid: string) => boolean;
  getListsByFid: (fid: string) => List[];

  // Auto-interaction list methods
  addAutoInteractionList: (
    name: string,
    fids: string[],
    sourceAccountId: string,
    actionType: 'like' | 'recast' | 'both',
    onlyTopCasts: boolean,
    requireMentions?: string[],
    feedSource?: 'specific_users' | 'following',
    requiredUrls?: string[],
    requiredKeywords?: string[]
  ) => Promise<void>;
  updateAutoInteractionSettings: (listId: UUID, settings: Partial<AutoInteractionListContent>) => Promise<void>;
  getAutoInteractionLists: () => List[];
}

export interface ListStore extends ListStoreProps, ListStoreActions {}

export const mutative =
  <T>(config: (set: (fn: (draft: Draft<T>) => void) => void, get: () => T) => T) =>
  (set: (fn: (state: T) => T | void) => void, get: () => T) =>
    config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<ListStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet, get: () => ListStore) => ({
  lists: [],
  searches: [],
  isHydrated: false,
  selectedListId: undefined,
  currentSearchTerm: undefined,
  addSearch: (search: Search) => {
    set((state) => {
      state.searches = [...state.searches, search];
    });
  },
  setCurrentSearchTerm: (term?: string) => {
    set((state) => {
      state.currentSearchTerm = term;
    });
  },
  // Helper methods for working with FIDs in lists
  addFidToList: async (listId: UUID, fid: string, displayName?: string) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.type !== 'fids') {
      throw new Error('FID list not found or invalid list type');
    }

    const content = list.contents as FidListContent;
    if (!content.fids.includes(fid)) {
      // Add new FID to the beginning of the list
      const updatedFids = [fid, ...content.fids];
      const updatedDisplayNames = { ...content.displayNames };

      if (displayName) {
        updatedDisplayNames[fid] = displayName;
      }

      const { data, error } = await supabaseClient
        .from('list')
        .update({
          contents: {
            fids: updatedFids,
            displayNames: updatedDisplayNames,
          },
        })
        .eq('id', listId)
        .select();

      if (error) {
        throw new Error(`Failed to add FID to list: ${error.message}`);
      }

      const idx = get().lists.findIndex((l) => l.id === listId);
      set((state) => {
        state.lists[idx] = data?.[0] as List;
      });
    }
  },

  removeFidFromList: async (listId: UUID, fid: string) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.type !== 'fids') {
      throw new Error('FID list not found or invalid list type');
    }

    const content = list.contents as FidListContent;
    if (content.fids.includes(fid)) {
      const updatedFids = content.fids.filter((f) => f !== fid);
      const updatedDisplayNames = { ...content.displayNames };

      if (updatedDisplayNames && fid in updatedDisplayNames) {
        delete updatedDisplayNames[fid];
      }

      const { data, error } = await supabaseClient
        .from('list')
        .update({
          contents: {
            fids: updatedFids,
            displayNames: updatedDisplayNames,
          },
        })
        .eq('id', listId)
        .select();

      if (error) {
        throw new Error(`Failed to remove FID from list: ${error.message}`);
      }

      const idx = get().lists.findIndex((l) => l.id === listId);
      set((state) => {
        state.lists[idx] = data?.[0] as List;
      });
    }
  },

  updateFidDisplayName: async (listId: UUID, fid: string, displayName: string) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.type !== 'fids') {
      throw new Error('FID list not found or invalid list type');
    }

    const content = list.contents as FidListContent;
    if (content.fids.includes(fid)) {
      const updatedDisplayNames = {
        ...(content.displayNames || {}),
        [fid]: displayName,
      };

      const { data, error } = await supabaseClient
        .from('list')
        .update({
          contents: {
            fids: content.fids,
            displayNames: updatedDisplayNames,
          },
        })
        .eq('id', listId)
        .select();

      if (error) {
        throw new Error(`Failed to update FID display name: ${error.message}`);
      }

      const idx = get().lists.findIndex((l) => l.id === listId);
      set((state) => {
        state.lists[idx] = data?.[0] as List;
      });
    }
  },
  addFidList: async (name: string, fids: string[]) => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not logged in');
    }

    // Find the highest idx to place the new list after it
    const lists = useListStore.getState().lists;
    const highestIdx = lists.length > 0 ? Math.max(...lists.map((list) => list.idx)) : 0;

    const content: FidListContent = {
      fids,
      displayNames: {}, // Initialize empty display names mapping
    };

    const { data: list, error } = await supabaseClient
      .from('list')
      .insert([
        {
          name,
          type: 'fids',
          contents: content,
          user_id: user.id,
          idx: highestIdx + 1,
        },
      ])
      .select();

    if (error || !list) {
      throw new Error(`Failed to add FID list: ${error?.message}`);
    }

    set((state) => {
      state.lists = [...state.lists, list[0]];
    });
  },
  addList: async (newList: AddListType) => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not logged in');
    }

    // Find the highest idx to place the new list after it
    const lists = useListStore.getState().lists;
    const highestIdx = lists.length > 0 ? Math.max(...lists.map((list) => list.idx)) : 0;

    const { data: list, error } = await supabaseClient
      .from('list')
      .insert([
        {
          ...newList,
          user_id: user.id,
          idx: newList.idx || highestIdx + 1,
        },
      ])
      .select();

    if (error || !list) {
      throw new Error(`Failed to add list ${error?.message}`);
    }
    set((state) => {
      state.lists = [...state.lists, list[0]];
    });
  },
  updateList: async (search: UpdateList) => {
    if (!search.id) throw new Error('List id is required');
    
    // Remove id from the update payload and use it in the where clause
    const { id, ...updateData } = search;
    
    const { data, error } = await supabaseClient
      .from('list')
      .update(updateData)
      .eq('id', id)
      .select();
      
    if (error) {
      throw new Error(`Failed to update list: ${error.message}`);
    }
    
    const idx = useListStore.getState().lists.findIndex((s) => s.id === id);
    set((state) => {
      state.lists[idx] = data?.[0] as List;
    });
  },
  updateFidList: async (listId: UUID, name: string, fids: string[]) => {
    const existingList = useListStore.getState().lists.find((list) => list.id === listId);
    if (!existingList) {
      throw new Error('FID list not found');
    }

    // Preserve displayNames if they exist in the current list
    let displayNames = {};
    if (isFidListContent(existingList.contents)) {
      displayNames = existingList.contents.displayNames || {};
    }

    const { data, error } = await supabaseClient
      .from('list')
      .update({
        name,
        contents: {
          fids,
          displayNames,
        },
      })
      .eq('id', listId)
      .select();

    if (error) {
      throw new Error(`Failed to update FID list: ${error.message}`);
    }

    const idx = useListStore.getState().lists.findIndex((list) => list.id === listId);
    set((state) => {
      state.lists[idx] = data?.[0] as List;
    });
  },
  removeList: async (listId: UUID) => {
    const { error } = await supabaseClient.from('list').delete().eq('id', listId);
    if (error) {
      throw new Error('Failed to remove list');
    }
    set((state) => {
      state.lists = state.lists.filter((list) => list.id !== listId);
    });
  },
  setSelectedListId: (id?: UUID) => {
    set((state) => {
      state.selectedListId = id;
    });
  },
  getFidLists: () => {
    return get().lists.filter((list) => list.type === 'fids');
  },

  getSearchLists: () => {
    return get().lists.filter((list) => list.type === 'search');
  },

  isFidInList: (listId: UUID, fid: string) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.type !== 'fids') return false;

    const content = list.contents as FidListContent;
    return content.fids.includes(fid);
  },

  getListsByFid: (fid: string) => {
    return get().lists.filter((list) => {
      if (list.type !== 'fids') return false;
      const content = list.contents as FidListContent;
      return content.fids.includes(fid);
    });
  },

  hydrate: async () => {
    if (useListStore.getState().isHydrated) return;

    try {
      const { data: lists, error } = await supabaseClient.from('list').select('*').order('idx', { ascending: true });

      if (error) {
        throw new Error('Failed to fetch lists from server');
      }
      set((state) => {
        state.lists = lists as List[];
        state.isHydrated = true;
      });
    } catch (error) {
      console.error('Failed to hydrate ListStore:', error);
    }
  },

  // Auto-interaction list methods
  addAutoInteractionList: async (
    name: string,
    fids: string[],
    sourceAccountId: string,
    actionType: 'like' | 'recast' | 'both',
    onlyTopCasts: boolean,
    requireMentions?: string[],
    feedSource: 'specific_users' | 'following' = 'specific_users',
    requiredUrls?: string[],
    requiredKeywords?: string[]
  ) => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not logged in');
    }

    const lists = useListStore.getState().lists;
    const highestIdx = lists.length > 0 ? Math.max(...lists.map((list) => list.idx)) : 0;

    const content: AutoInteractionListContent = {
      fids,
      displayNames: {},
      sourceAccountId,
      actionType,
      onlyTopCasts,
      requireMentions,
      feedSource,
      requiredUrls,
      requiredKeywords,
    };

    const { data: list, error } = await supabaseClient
      .from('list')
      .insert([
        {
          name,
          type: 'auto_interaction',
          contents: content,
          user_id: user.id,
          idx: highestIdx + 1,
        },
      ])
      .select();

    if (error || !list) {
      throw new Error(`Failed to add auto-interaction list: ${error?.message}`);
    }

    set((state) => {
      state.lists = [...state.lists, list[0]];
    });
  },

  updateAutoInteractionSettings: async (listId: UUID, settings: Partial<AutoInteractionListContent>) => {
    const list = get().lists.find((l) => l.id === listId);
    if (!list || list.type !== 'auto_interaction') {
      throw new Error('Auto-interaction list not found or invalid list type');
    }

    const currentContent = list.contents as AutoInteractionListContent;
    const updatedContent = { ...currentContent, ...settings };

    const { data, error } = await supabaseClient
      .from('list')
      .update({
        contents: updatedContent,
      })
      .eq('id', listId)
      .select();

    if (error) {
      throw new Error(`Failed to update auto-interaction settings: ${error.message}`);
    }

    const idx = get().lists.findIndex((l) => l.id === listId);
    set((state) => {
      state.lists[idx] = data?.[0] as List;
    });
  },

  getAutoInteractionLists: () => {
    return get().lists.filter((list) => list.type === 'auto_interaction');
  },
});

// Type guard helper functions
export const isFidList = (list: List): boolean => list.type === 'fids';
export const isSearchList = (list: List): boolean => list.type === 'search';
export const isAutoInteractionList = (list: List): boolean => list.type === 'auto_interaction';

export const useListStore = create<ListStore>()(devtools(mutative(store)));
