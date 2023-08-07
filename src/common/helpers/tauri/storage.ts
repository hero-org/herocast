import { Store } from "tauri-plugin-store-api";

interface Stores {
  [key: string]: Store;
}

const stores: Stores = {};

export function getTauriStore(filename: string) {
    if (!(filename in stores)) stores[filename] = new Store(filename);
    return stores[filename];
}
