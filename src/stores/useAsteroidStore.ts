import create, { State } from "zustand";
import { devtools } from "zustand/middleware";
import { create as mutativeCreate, Draft } from 'mutative';

export interface AsteroidStore {
  asteroids: number;
  increaseAsteroids: () => void;
  decreaseAsteroids: () => void;
  removeAllAsteroids: () => void;
}

export const mutative = (config) =>
  (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<AsteroidStore>) => void) => void;

const store = (set: StoreSet) => ({
  asteroids: 0,
  increaseAsteroids: () => {
    set((state) => {
      state.asteroids++;
    });
  },
  decreaseAsteroids: () => {
    set((state) => {
      if (state.asteroids > 0) {
        state.asteroids--;
      }
    });
  },
  removeAllAsteroids: () => {
    set((state) => {
      state.asteroids = 0;
    });
  },
});
export const useAsteroidStore = create<AsteroidStore>()(devtools(mutative(store)));
