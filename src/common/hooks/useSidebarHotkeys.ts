import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppHotkeys, useMultipleHotkeys } from './useAppHotkeys';
import { HotkeyScopes } from '../constants/hotkeys';
import { useListStore } from '@/stores/useListStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { List } from '@/common/types/database.types';
import { UUID } from 'crypto';

interface UseSidebarHotkeysProps {
  searchLists: (List & { id: UUID })[];
  fidLists: (List & { id: UUID })[];
  onItemClick?: () => void;
}

export const useSidebarHotkeys = ({ searchLists, fidLists, onItemClick }: UseSidebarHotkeysProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { setSelectedListId } = useListStore();
  const { setSelectedChannelUrl } = useAccountStore();

  const navigateToSearch = useCallback(
    (index: number) => {
      if (searchLists && searchLists[index]) {
        const list = searchLists[index];
        setSelectedListId(list.id);
        setSelectedChannelUrl(null);
        if (onItemClick) onItemClick();

        // Navigate to feed if not already there
        if (pathname !== '/feeds') {
          router.push('/feeds');
        }
      }
    },
    [searchLists, setSelectedListId, setSelectedChannelUrl, onItemClick, router]
  );

  const navigateToList = useCallback(
    (index: number) => {
      if (fidLists && fidLists[index]) {
        const list = fidLists[index];
        setSelectedListId(list.id);
        setSelectedChannelUrl(null);
        if (onItemClick) onItemClick();

        // Navigate to feed if not already there
        if (pathname !== '/feeds') {
          router.push('/feeds');
        }
      }
    },
    [fidLists, setSelectedListId, setSelectedChannelUrl, onItemClick, router]
  );

  // Create hotkey handlers for search items (g>s>1 through g>s>9)
  const searchHotkeys = Array.from({ length: 9 }, (_, i) => ({
    keys: `g>s>${i + 1}`,
    callback: () => navigateToSearch(i),
    options: {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      sequenceTimeoutMs: 2000, // 2 seconds for sequential key input
    },
  }));

  // Create hotkey handlers for list items (g>l>1 through g>l>9)
  const listHotkeys = Array.from({ length: 9 }, (_, i) => ({
    keys: `g>l>${i + 1}`,
    callback: () => navigateToList(i),
    options: {
      scopes: HotkeyScopes.FEED,
      enableOnFormTags: false,
      sequenceTimeoutMs: 2000, // 2 seconds for sequential key input
    },
  }));

  // Register all hotkeys
  useMultipleHotkeys([...searchHotkeys, ...listHotkeys], [searchLists, fidLists, navigateToSearch, navigateToList]);
};
