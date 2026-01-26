import type { StateStorage } from 'zustand/middleware';

export class IndexedDBStorage implements StateStorage {
  private dbName: string;
  private dbPromise: Promise<IDBDatabase>;

  constructor(dbName: string) {
    this.dbName = dbName;
    // Only initialize DB promise in browser environment
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.dbPromise = this.openDB();
    } else {
      this.dbPromise = Promise.reject(new Error('IndexedDB is not available'));
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Check if we're in the browser environment
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async withStore(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => void): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('store', mode);
      const store = transaction.objectStore('store');
      callback(store);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getItem(name: string): Promise<string | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('store', 'readonly');
      const store = transaction.objectStore('store');
      const request = store.get(name);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async setItem(name: string, value: string): Promise<void> {
    await this.withStore('readwrite', (store) => {
      store.put(value, name);
    });
  }

  async removeItem(name: string): Promise<void> {
    await this.withStore('readwrite', (store) => {
      store.delete(name);
    });
  }
}
