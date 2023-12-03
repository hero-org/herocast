import { Store } from "tauri-plugin-store-api";
import { StateStorage } from "zustand/middleware";

interface Stores {
  [key: string]: Store;
}

const stores: Stores = {};

export function getTauriStore(filename: string) {
  if (!(filename in stores)) stores[filename] = new Store(filename);
  return stores[filename];
}

export const getStateStorageForStore = (store: Store): StateStorage => {
  // console.log('getStateStorageForStore', store)
  return {
    getItem: async (name: string): Promise<string | null> => {
      console.log(name, 'has been retrieved')
      return store.get(name) || null
    },
    setItem: async (name: string, value: string): Promise<void> => {
      console.log(name, 'with value', value, 'has been saved')
      await store.set(name, value)
      await store.save()
    },
    removeItem: async (name: string): Promise<void> => {
      console.log(name, 'has been deleted')
      await store.delete(name)
      await store.save()
    }
  }
};
