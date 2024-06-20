/* eslint-disable @typescript-eslint/no-unsafe-call */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';
import { createClient } from "@/common/helpers/supabase/component";
import { InsertList, List } from '@/common/types/database.types'
import { UUID } from "crypto";


export type Search = {
  term: string;
  startedAt: number;
  endedAt: number;
  resultsCount: number;
};

type AddListType = Omit<InsertList, 'user_id'>;

interface SearchStoreProps {
  searches: Search[];
  lists: List[];
  selectedList: List | null;
}

interface SearchStoreActions {
  addSearch: (search: Search) => void;
  addList: (newList: AddListType) => void;
  removeList: (listId: number) => void;
  updateSelectedList: (list: List) => void;
}

export interface ListStore extends SearchStoreProps, SearchStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<ListStore>) => void) => void;

const supabaseClient = createClient();

const store = (set: StoreSet) => ({
  lists: [],
  searches: [],
  selectedList: null,
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
  removeList: async (listId: UUID) => {
    const { error } = await supabaseClient.from('list').delete().eq('id', listId);
    if (error) {
      throw new Error('Failed to remove list');
    }
    set((state) => {
      state.lists = state.lists.filter((list) => list.id !== listId);
    });
  },
  updateSelectedList: (list: List) => {
    set((state) => {
      state.selectedList = list;
    });
  }
});

export const hydrateListStore = async () => {
  try {
    const { data: lists, error } = await supabaseClient.from('list').select('*');
    if (error) {
      throw new Error('Failed to fetch lists from server');
    }
    useListStore.getState().lists = lists;
  } catch (error) {
    console.error('Failed to hydrate ListStore:', error);
  }
};

// client-side-only
if (typeof window !== 'undefined') {
  hydrateListStore();
}


export const useListStore = create<ListStore>()(devtools(mutative(store)));

