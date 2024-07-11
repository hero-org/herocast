import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { createClient } from "@/common/helpers/supabase/component";
import { InsertList, List, UpdateList } from '@/common/types/database.types'
import { UUID } from "crypto";


export type Search = {
  term: string;
  startedAt: number;
  endedAt: number;
  resultsCount: number;
};

type AddListType = Omit<InsertList, 'user_id'>;

interface ListStoreProps {
  searches: Search[];
  lists: List[];
  isHydrated: boolean;
  selectedListIdx?: number;
}

interface ListStoreActions {
  hydrate: () => void;
  addSearch: (search: Search) => void;
  updateSearch: (search: UpdateList) => void;
  addList: (newList: AddListType) => void;
  removeList: (listId: UUID) => void;
  setSelectedListIdx: (idx: number) => void;
}

export interface ListStore extends ListStoreProps, ListStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<ListStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  lists: [],
  searches: [],
  isHydrated: false,
  selectedListIdx: undefined,
  addSearch: (search: Search) => {
    set((state) => {
      state.searches = [...state.searches, search];
    });
  },
  addList: async (newList: AddListType) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not logged in');
    }
    const { data: list, error } = await supabaseClient
      .from('list')
      .insert([
        {
          ...newList, user_id: user.id,
        }])
      .select();

    if (error || !list) {
      throw new Error(`Failed to add list ${error?.message}`);
    }
    set((state) => {
      state.lists = [...state.lists, list[0]];
    });
  },
  updateSearch: async (search: UpdateList) => {
    if (!search.id) throw new Error('List id is required');
    // upsert to supabase
    const { data, error } = await supabaseClient.from('list').upsert(search);
    console.log('data', data, 'error', error);
    if (error) {
      throw new Error('Failed to update list');
    }
    const idx = useListStore.getState().searches.findIndex((s) => s?.id === search.id);
    useListStore.getState().searches[idx] = data;
    console.log('update local list with data', data);
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
  setSelectedListIdx: (idx?: number) => {
    set((state) => {
      state.selectedListIdx = idx;
    });
  },
  hydrate: async () => {
    if (useListStore.getState().isHydrated) return;

    try {
      const { data: lists, error } = await supabaseClient.from('list').select('*');
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
  }
});


export const useListStore = create<ListStore>()(devtools(mutative(store)));
