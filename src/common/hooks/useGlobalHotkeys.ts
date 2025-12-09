import { useRouter, usePathname } from 'next/navigation';
import { useAppHotkeys } from './useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { useAccountStore } from '@/stores/useAccountStore';
import { useNavigationStore, CastModalView } from '@/stores/useNavigationStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { useDataStore } from '@/stores/useDataStore';
import { useTheme } from 'next-themes';
import { CUSTOM_CHANNELS } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { createParentCastId } from '@/common/constants/farcaster';
import { useCallback } from 'react';
import { UUID } from 'crypto';

// Hook that registers all global hotkeys for the app
export function useGlobalHotkeys() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { theme, setTheme } = useTheme();
  const { toggleCommandPalette, openNewCastModal, setCastModalView, setCastModalDraftId } = useNavigationStore();
  const { accounts, selectedAccountIdx, setCurrentAccountIdx, setSelectedChannelUrl } = useAccountStore();
  const { setSelectedListId, getSearchLists, getFidLists } = useListStore();
  const { addNewPostDraft } = useDraftStore();
  const { selectedCast } = useDataStore();

  // Get lists for sidebar hotkeys
  const searchLists = getSearchLists();
  const fidLists = getFidLists();

  // Helper to navigate to a list
  const navigateToList = useCallback(
    (listId: UUID) => {
      setSelectedListId(listId);
      setSelectedChannelUrl(null);
      if (pathname !== '/feeds') {
        router.push('/feeds');
      }
    },
    [setSelectedListId, setSelectedChannelUrl, pathname, router]
  );

  // ============================================
  // Command palette - highest priority
  // ============================================
  useAppHotkeys(
    ['meta+k', 'ctrl+k'],
    () => {
      toggleCommandPalette();
    },
    {
      scopes: HotkeyScopes.GLOBAL,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [toggleCommandPalette]
  );

  // ============================================
  // Navigation hotkeys
  // ============================================
  useAppHotkeys('shift+f', () => router.push('/feeds'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  useAppHotkeys('/', () => router.push('/search'), { scopes: HotkeyScopes.GLOBAL, preventDefault: true }, [router]);

  useAppHotkeys('shift+c', () => router.push('/channels'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  useAppHotkeys('shift+n', () => router.push('/inbox'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  useAppHotkeys('shift+m', () => router.push('/dms'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  useAppHotkeys('meta+shift+,', () => router.push('/settings'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  useAppHotkeys(
    'meta+shift+p',
    () => {
      const selectedAccountName = accounts[selectedAccountIdx]?.user?.username;
      if (selectedAccountName) {
        router.push(`/profile/${selectedAccountName}`);
      }
    },
    { scopes: HotkeyScopes.GLOBAL },
    [router, accounts, selectedAccountIdx]
  );

  useAppHotkeys('meta+shift+a', () => router.push('/accounts'), { scopes: HotkeyScopes.GLOBAL }, [router]);

  // ============================================
  // Theme switching
  // ============================================
  useAppHotkeys('meta+shift+l', () => setTheme('light'), { scopes: HotkeyScopes.GLOBAL }, [setTheme]);

  useAppHotkeys('meta+shift+d', () => setTheme('dark'), { scopes: HotkeyScopes.GLOBAL }, [setTheme]);

  // ============================================
  // Post creation
  // ============================================
  useAppHotkeys(
    'c',
    () => {
      addNewPostDraft({
        onSuccess: (draftId) => {
          setCastModalView(CastModalView.New);
          setCastModalDraftId(draftId);
          openNewCastModal();
        },
      });
    },
    { scopes: HotkeyScopes.GLOBAL },
    [addNewPostDraft, setCastModalView, setCastModalDraftId, openNewCastModal]
  );

  // Reply shortcut (when cast is selected)
  useAppHotkeys(
    'r',
    () => {
      if (!selectedCast) return;

      addNewPostDraft({
        parentCastId: createParentCastId(selectedCast.author.fid, selectedCast.hash, 'useGlobalHotkeys.reply'),
        onSuccess: (draftId) => {
          setCastModalView(CastModalView.Reply);
          setCastModalDraftId(draftId);
          openNewCastModal();
        },
      });
    },
    {
      scopes: HotkeyScopes.CAST_SELECTED,
      enabled: !!selectedCast,
    },
    [selectedCast, addNewPostDraft, setCastModalView, setCastModalDraftId, openNewCastModal]
  );

  // Quote shortcut (when cast is selected)
  useAppHotkeys(
    'q',
    () => {
      if (!selectedCast) return;

      addNewPostDraft({
        embeds: [
          {
            castId: {
              fid: selectedCast.author.fid,
              hash: new TextEncoder().encode(selectedCast.hash),
            },
          },
        ],
        onSuccess: (draftId) => {
          setCastModalView(CastModalView.Quote);
          setCastModalDraftId(draftId);
          openNewCastModal();
        },
      });
    },
    {
      scopes: HotkeyScopes.CAST_SELECTED,
      enabled: !!selectedCast,
    },
    [selectedCast, addNewPostDraft, setCastModalView, setCastModalDraftId, openNewCastModal]
  );

  // ============================================
  // Account switching (ctrl+1 through ctrl+9)
  // ============================================
  useAppHotkeys(
    'ctrl+1',
    () => {
      if (0 < accounts.length) setCurrentAccountIdx(0);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+2',
    () => {
      if (1 < accounts.length) setCurrentAccountIdx(1);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+3',
    () => {
      if (2 < accounts.length) setCurrentAccountIdx(2);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+4',
    () => {
      if (3 < accounts.length) setCurrentAccountIdx(3);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+5',
    () => {
      if (4 < accounts.length) setCurrentAccountIdx(4);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+6',
    () => {
      if (5 < accounts.length) setCurrentAccountIdx(5);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+7',
    () => {
      if (6 < accounts.length) setCurrentAccountIdx(6);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+8',
    () => {
      if (7 < accounts.length) setCurrentAccountIdx(7);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );
  useAppHotkeys(
    'ctrl+9',
    () => {
      if (8 < accounts.length) setCurrentAccountIdx(8);
    },
    { scopes: HotkeyScopes.GLOBAL },
    [accounts.length, setCurrentAccountIdx]
  );

  // ============================================
  // Feed switching (shift+0 and shift+1)
  // ============================================
  const isFeedsPage = pathname === '/feeds';

  useAppHotkeys(
    'shift+0',
    () => {
      if (isFeedsPage) {
        setSelectedChannelUrl(CUSTOM_CHANNELS.FOLLOWING);
        setSelectedListId(undefined);
      }
    },
    {
      scopes: HotkeyScopes.FEED,
      enabled: isFeedsPage,
    },
    [isFeedsPage, setSelectedChannelUrl, setSelectedListId]
  );

  useAppHotkeys(
    'shift+1',
    () => {
      if (isFeedsPage) {
        setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING);
        setSelectedListId(undefined);
      }
    },
    {
      scopes: HotkeyScopes.FEED,
      enabled: isFeedsPage,
    },
    [isFeedsPage, setSelectedChannelUrl, setSelectedListId]
  );

  // ============================================
  // Sidebar: Search list hotkeys (g>s>1 through g>s>9)
  // Navigate to search lists from anywhere in the app
  // ============================================
  useAppHotkeys(
    'g>s>1',
    () => {
      if (searchLists[0]) navigateToList(searchLists[0].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>2',
    () => {
      if (searchLists[1]) navigateToList(searchLists[1].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>3',
    () => {
      if (searchLists[2]) navigateToList(searchLists[2].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>4',
    () => {
      if (searchLists[3]) navigateToList(searchLists[3].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>5',
    () => {
      if (searchLists[4]) navigateToList(searchLists[4].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>6',
    () => {
      if (searchLists[5]) navigateToList(searchLists[5].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>7',
    () => {
      if (searchLists[6]) navigateToList(searchLists[6].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>8',
    () => {
      if (searchLists[7]) navigateToList(searchLists[7].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );
  useAppHotkeys(
    'g>s>9',
    () => {
      if (searchLists[8]) navigateToList(searchLists[8].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [searchLists, navigateToList]
  );

  // ============================================
  // Sidebar: FID list hotkeys (g>l>1 through g>l>9)
  // Navigate to user lists from anywhere in the app
  // ============================================
  useAppHotkeys(
    'g>l>1',
    () => {
      if (fidLists[0]) navigateToList(fidLists[0].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>2',
    () => {
      if (fidLists[1]) navigateToList(fidLists[1].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>3',
    () => {
      if (fidLists[2]) navigateToList(fidLists[2].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>4',
    () => {
      if (fidLists[3]) navigateToList(fidLists[3].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>5',
    () => {
      if (fidLists[4]) navigateToList(fidLists[4].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>6',
    () => {
      if (fidLists[5]) navigateToList(fidLists[5].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>7',
    () => {
      if (fidLists[6]) navigateToList(fidLists[6].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>8',
    () => {
      if (fidLists[7]) navigateToList(fidLists[7].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
  useAppHotkeys(
    'g>l>9',
    () => {
      if (fidLists[8]) navigateToList(fidLists[8].id as UUID);
    },
    { scopes: HotkeyScopes.GLOBAL, enableOnFormTags: false },
    [fidLists, navigateToList]
  );
}
