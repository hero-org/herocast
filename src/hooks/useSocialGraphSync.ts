'use client';

import { useEffect, useRef } from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import { useSocialGraphStore } from '@/stores/useSocialGraphStore';

const HYPERSNAP_BASE = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com/v2/farcaster';
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const PAGE_SIZE = 150;
const MAX_RELATIONSHIPS = 20_000;
const MAX_SYNC_DURATION_MS = 10_000;

interface UserListResponse {
  users: Array<{ fid: number }>;
  next?: { cursor?: string };
}

function isValidFid(fid: number | null): fid is number {
  return fid !== null && Number.isInteger(fid) && fid > 0;
}

async function fetchAllFids(endpoint: string, fid: number): Promise<number[]> {
  if (!isValidFid(fid)) {
    return [];
  }

  const fids = new Set<number>();
  let cursor: string | undefined;
  let page = 0;
  const startedAt = Date.now();

  while (true) {
    const url = new URL(`${HYPERSNAP_BASE}/${endpoint}`);
    url.searchParams.set('fid', String(fid));
    url.searchParams.set('limit', String(PAGE_SIZE));
    if (cursor) url.searchParams.set('cursor', cursor);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) break;
      const data: UserListResponse = await res.json();
      const users = data.users || [];

      for (const user of users) {
        if (isValidFid(user.fid)) {
          fids.add(user.fid);
        }
      }

      cursor = data.next?.cursor;
      page += 1;

      if (!cursor || users.length < PAGE_SIZE) break;
      if (fids.size >= MAX_RELATIONSHIPS) {
        console.warn(`[SocialGraphSync] Truncated ${endpoint} sync for fid ${fid} after ${fids.size} relationships`);
        break;
      }
      if (Date.now() - startedAt >= MAX_SYNC_DURATION_MS) {
        console.warn(`[SocialGraphSync] Timed out ${endpoint} sync for fid ${fid} after ${page} pages`);
        break;
      }
    } catch (err) {
      console.warn(`[SocialGraphSync] Failed to fetch ${endpoint} page ${page}:`, err);
      break;
    }
  }

  return Array.from(fids);
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
    if (!isValidFid(activeFid) || syncingRef.current) return;
    if (!useSocialGraphStore.getState().needsSync(activeFid)) return;

    syncingRef.current = true;
    syncSocialGraph(activeFid).finally(() => {
      syncingRef.current = false;
    });
  }, [activeFid]);

  // Periodic refresh
  useEffect(() => {
    if (!isValidFid(activeFid)) return;

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
