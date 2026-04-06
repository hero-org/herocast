'use client';

import { useEffect, useRef } from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSocialGraphStore } from '@/stores/useSocialGraphStore';

const HYPERSNAP_BASE = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com/v2/farcaster';
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface UserListResponse {
  users: Array<{ fid: number }>;
  next?: { cursor?: string };
}

async function fetchAllFids(endpoint: string, fid: number): Promise<number[]> {
  const fids: number[] = [];
  let cursor: string | undefined;

  // Paginate through results (max 10 pages to avoid runaway)
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${HYPERSNAP_BASE}/${endpoint}`);
    url.searchParams.set('fid', String(fid));
    url.searchParams.set('limit', '150');
    if (cursor) url.searchParams.set('cursor', cursor);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) break;
      const data: UserListResponse = await res.json();

      for (const user of data.users || []) {
        fids.push(user.fid);
      }

      cursor = data.next?.cursor;
      if (!cursor || (data.users?.length || 0) < 150) break;
    } catch (err) {
      console.warn(`[SocialGraphSync] Failed to fetch ${endpoint} page ${page}:`, err);
      break;
    }
  }

  return fids;
}

async function syncSocialGraph(fid: number) {
  const [followingFids, followerFids] = await Promise.all([
    fetchAllFids('user/following', fid),
    fetchAllFids('user/followers', fid),
  ]);

  useSocialGraphStore.getState().setSyncData({ followingFids, followerFids, fid });
}

export function useSocialGraphSync() {
  const syncingRef = useRef(false);
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountIdx = useAccountStore((s) => s.selectedAccountIdx);
  // Get active account's FID
  const activeFid = accounts[selectedAccountIdx]?.platformAccountId
    ? Number(accounts[selectedAccountIdx].platformAccountId)
    : null;

  // Initial sync when account becomes available or changes
  useEffect(() => {
    if (!activeFid || syncingRef.current) return;
    if (!useSocialGraphStore.getState().needsSync(activeFid)) return;

    syncingRef.current = true;
    syncSocialGraph(activeFid).finally(() => {
      syncingRef.current = false;
    });
  }, [activeFid]);

  // Periodic refresh
  useEffect(() => {
    if (!activeFid) return;

    const interval = setInterval(() => {
      if (!syncingRef.current && useSocialGraphStore.getState().needsSync(activeFid)) {
        syncingRef.current = true;
        syncSocialGraph(activeFid).finally(() => {
          syncingRef.current = false;
        });
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [activeFid]);
}
