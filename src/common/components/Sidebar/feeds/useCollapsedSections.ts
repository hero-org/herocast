'use client';

/**
 * useCollapsedSections — persists the open/closed state of the two collapsible
 * sidebar groups (Channels / Lists) to localStorage. Both default OPEN, since
 * discoverability is the whole point of the disclosure direction.
 *
 * Hydration-safe: the first server + client render always use DEFAULT_STATE, so
 * the markup matches; the persisted value is applied one tick later in an
 * effect. All storage access is wrapped so it never throws (SSR, private mode,
 * quota).
 */

import { useEffect, useRef, useState } from 'react';
import type { SidebarFeedGroup } from './types';

const STORAGE_KEY = 'herocast:sidebar:feed-sections';

type SectionState = Record<SidebarFeedGroup, boolean>;

const DEFAULT_STATE: SectionState = { channels: true, lists: true };

function readPersistedState(): SectionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SectionState>;
    return {
      channels: typeof parsed.channels === 'boolean' ? parsed.channels : DEFAULT_STATE.channels,
      lists: typeof parsed.lists === 'boolean' ? parsed.lists : DEFAULT_STATE.lists,
    };
  } catch {
    return null;
  }
}

export function useCollapsedSections(): {
  isOpen: (g: SidebarFeedGroup) => boolean;
  toggle: (g: SidebarFeedGroup) => void;
} {
  const [state, setState] = useState<SectionState>(DEFAULT_STATE);
  // Skip persisting the initial DEFAULT_STATE commit so we don't clobber a
  // stored value before the load effect below has read it.
  const skipNextPersist = useRef(true);

  useEffect(() => {
    const persisted = readPersistedState();
    if (persisted) setState(persisted);
  }, []);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode, quota) — keep in-memory state only.
    }
  }, [state]);

  const isOpen = (g: SidebarFeedGroup) => state[g];
  const toggle = (g: SidebarFeedGroup) => setState((prev) => ({ ...prev, [g]: !prev[g] }));

  return { isOpen, toggle };
}
