/* eslint-disable @typescript-eslint/no-unsafe-call */
import { type Draft, create as mutativeCreate } from 'mutative';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { IndexedDBStorage } from './StoreStorage';

const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface SocialGraphStoreProps {
  /** FIDs the active user follows (stored as array for serialization) */
  followingFids: number[];
  /** FIDs that follow the active user */
  followerFids: number[];
  /** Timestamp of last full sync */
  lastSyncedAt: number;
  /** FID this graph belongs to */
  syncedForFid: number | null;
  isHydrated: boolean;
}

interface SocialGraphStoreActions {
  /** Check if active user follows this FID */
  isFollowing: (fid: number) => boolean;
  /** Check if this FID follows the active user */
  isFollowedBy: (fid: number) => boolean;
  /** Optimistic update: user followed someone */
  addFollowing: (fid: number) => void;
  /** Optimistic update: user unfollowed someone */
  removeFollowing: (fid: number) => void;
  /** Set the full following/follower lists (called after sync) */
  setSyncData: (data: { followingFids: number[]; followerFids: number[]; fid: number }) => void;
  /** Check if sync is needed */
  needsSync: (fid: number) => boolean;
}

export interface SocialGraphStore extends SocialGraphStoreProps, SocialGraphStoreActions {}

const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);

type StoreSet = (fn: (draft: Draft<SocialGraphStore>) => void) => void;
type StoreGet = () => SocialGraphStore;

// Memoized Sets for O(1) lookups — rebuilt when arrays change
let _followingSet: Set<number> = new Set();
let _followerSet: Set<number> = new Set();
let _followingVersion = 0;
let _followerVersion = 0;

const store = (set: StoreSet, get: StoreGet) => ({
  followingFids: [] as number[],
  followerFids: [] as number[],
  lastSyncedAt: 0,
  syncedForFid: null as number | null,
  isHydrated: false,

  isFollowing: (fid: number) => {
    const state = get();
    if (state.syncedForFid === null) return false;
    // Rebuild set if array length changed (cheap version check)
    if (state.followingFids.length !== _followingVersion) {
      _followingSet = new Set(state.followingFids);
      _followingVersion = state.followingFids.length;
    }
    return _followingSet.has(fid);
  },

  isFollowedBy: (fid: number) => {
    const state = get();
    if (state.syncedForFid === null) return false;
    if (state.followerFids.length !== _followerVersion) {
      _followerSet = new Set(state.followerFids);
      _followerVersion = state.followerFids.length;
    }
    return _followerSet.has(fid);
  },

  addFollowing: (fid: number) => {
    set((state) => {
      if (!state.followingFids.includes(fid)) {
        state.followingFids.push(fid);
      }
    });
  },

  removeFollowing: (fid: number) => {
    set((state) => {
      state.followingFids = state.followingFids.filter((f) => f !== fid);
    });
  },

  setSyncData: ({ followingFids, followerFids, fid }) => {
    set((state) => {
      state.followingFids = followingFids;
      state.followerFids = followerFids;
      state.lastSyncedAt = Date.now();
      state.syncedForFid = fid;
    });
  },

  needsSync: (fid: number) => {
    const state = get();
    return state.syncedForFid !== fid || Date.now() - state.lastSyncedAt > SYNC_INTERVAL;
  },
});

const storage = new IndexedDBStorage('herocast-social-graph-store');

export const useSocialGraphStore = create<SocialGraphStore>()(
  devtools(
    persist(mutative(store), {
      name: 'herocast-social-graph-store',
      storage: createJSONStorage(() => storage),
      partialize: (state: SocialGraphStore) => ({
        followingFids: state.followingFids,
        followerFids: state.followerFids,
        lastSyncedAt: state.lastSyncedAt,
        syncedForFid: state.syncedForFid,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    })
  )
);
