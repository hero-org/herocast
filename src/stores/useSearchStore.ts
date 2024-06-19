/* eslint-disable @typescript-eslint/no-unsafe-call */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';


export type Search = {
  term: string;
  startedAt: number;
  endedAt: number;
  resultsCount: number;
};

interface SearchStoreProps {
  searches: Search[];
}

interface SearchStoreActions {
  addSearch: (search: Search) => void;
}

export interface SearchStore extends SearchStoreProps, SearchStoreActions { }

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<SearchStore>) => void) => void;

const store = (set: StoreSet) => ({
  searches: [],
  addSearch: (search: Search) => {
    set((state) => {
      state.searches = [...state.searches, search];
    });
  }
});

export const useSearchStore = create<SearchStore>()(devtools(mutative(store)));

