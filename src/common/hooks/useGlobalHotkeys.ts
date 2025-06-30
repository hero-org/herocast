import { useRouter } from 'next/router';
import { useAppHotkeys, useMultipleHotkeys } from './useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { useAccountStore } from '@/stores/useAccountStore';
import { useNavigationStore, CastModalView } from '@/stores/useNavigationStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { useDataStore } from '@/stores/useDataStore';
import { useTheme } from 'next-themes';
import { CUSTOM_CHANNELS } from '@/stores/useAccountStore';

// Hook that registers all global hotkeys for the app
export function useGlobalHotkeys() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { toggleCommandPalette, openNewCastModal, setCastModalView } = useNavigationStore();
  const { accounts, selectedAccountIdx, setCurrentAccountIdx, setSelectedChannelUrl } = useAccountStore();
  const { addNewPostDraft } = useDraftStore();
  const { selectedCast } = useDataStore();

  // Command palette - highest priority (both meta+k and ctrl+k)
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

  // Navigation hotkeys
  useMultipleHotkeys(
    [
      {
        keys: 'shift+f',
        callback: () => router.push('/feeds'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: '/',
        callback: () => router.push('/search'),
        options: { scopes: HotkeyScopes.GLOBAL, preventDefault: true },
      },
      {
        keys: 'shift+c',
        callback: () => router.push('/channels'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: 'shift+n',
        callback: () => router.push('/notifications'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: 'meta+shift+,',
        callback: () => router.push('/settings'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: 'meta+shift+p',
        callback: () => {
          const selectedAccountName = accounts[selectedAccountIdx]?.user?.username;
          if (selectedAccountName) {
            router.push(`/profile/${selectedAccountName}`);
          }
        },
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: 'meta+shift+a',
        callback: () => {
          router.push('/accounts');
        },
        options: { scopes: HotkeyScopes.GLOBAL },
      },
    ],
    [router, accounts, selectedAccountIdx]
  );

  // Theme switching
  useMultipleHotkeys(
    [
      {
        keys: 'meta+shift+l',
        callback: () => setTheme('light'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
      {
        keys: 'meta+shift+d',
        callback: () => setTheme('dark'),
        options: { scopes: HotkeyScopes.GLOBAL },
      },
    ],
    [setTheme]
  );

  // Post creation
  useAppHotkeys(
    'c',
    () => {
      addNewPostDraft({});
      openNewCastModal();
    },
    { scopes: HotkeyScopes.GLOBAL },
    [addNewPostDraft, openNewCastModal]
  );

  // Reply shortcut (when cast is selected)
  useAppHotkeys(
    'r',
    () => {
      if (!selectedCast) return;

      addNewPostDraft({
        parentCastId: {
          fid: selectedCast.author.fid.toString(),
          hash: selectedCast.hash,
        },
      });
      setCastModalView(CastModalView.Reply);
      openNewCastModal();
    },
    {
      scopes: HotkeyScopes.CAST_SELECTED,
      enabled: !!selectedCast,
    },
    [selectedCast, addNewPostDraft, setCastModalView, openNewCastModal]
  );

  // Account switching - register all 9 shortcuts
  useMultipleHotkeys(
    Array.from({ length: 9 }, (_, i) => ({
      keys: `ctrl+${i + 1}`,
      callback: () => {
        if (i < accounts.length) {
          setCurrentAccountIdx(i);
        }
      },
      options: { scopes: HotkeyScopes.GLOBAL },
    })),
    [accounts.length, setCurrentAccountIdx]
  );

  // Feed switching (only on feeds page)
  const isFeedsPage = router.pathname === '/feeds';

  useAppHotkeys(
    'shift+0',
    () => {
      if (isFeedsPage) {
        setSelectedChannelUrl(CUSTOM_CHANNELS.FOLLOWING);
      }
    },
    {
      scopes: HotkeyScopes.FEED,
      enabled: isFeedsPage,
    },
    [isFeedsPage, setSelectedChannelUrl]
  );

  useAppHotkeys(
    'shift+1',
    () => {
      if (isFeedsPage) {
        setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING);
      }
    },
    {
      scopes: HotkeyScopes.FEED,
      enabled: isFeedsPage,
    },
    [isFeedsPage, setSelectedChannelUrl]
  );
}
