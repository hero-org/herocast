import React, { useMemo, useState, useCallback, ComponentType, SVGProps, useEffect, useRef } from 'react';
import { CommandType } from '@/common/constants/commands';
import { accountCommands, getChannelCommands, useAccountStore } from '@/stores/useAccountStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { newPostCommands, useDraftStore } from '@/stores/useDraftStore';
import {
  PayCasterBotPayDraft,
  PayCasterBotRequestDraft,
  RemindMeBotDraft,
  BountyCasterBotDraft,
  LaunchCasterScoutDraft,
  NewFeedbackPostDraft,
} from '@/common/constants/postDrafts';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { ChartBarIcon, MagnifyingGlassCircleIcon, UserCircleIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import commandScore from 'command-score';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/router';
import { getNavigationCommands } from '@/getNavigationCommands';
import { useTheme } from 'next-themes';
import { getThemeCommands } from '@/getThemeCommands';
import { formatShortcut } from '@/common/helpers/text';
import { DraftType } from '@/common/constants/farcaster';
import { useDataStore } from '@/stores/useDataStore';
import { getProfile } from '@/common/helpers/profileUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { FARCASTER_LOGO_URL, isWarpcastUrl, parseWarpcastUrl } from '@/common/helpers/warpcast';
import { cn } from '@/lib/utils';
import { startTiming, endTiming } from '@/stores/usePerformanceStore';

const MIN_SCORE_THRESHOLD = 0.0015;

// Cache static commands that don't depend on user state
// eslint-disable-next-line prefer-const
let cachedStaticCommands: CommandType[] | null = null;
let cachedFarcasterBotCommands: CommandType[] | null = null;

const createFarcasterBotCommand = (name: string, action: () => void, navigateTo?: string): CommandType => ({
  name,
  action,
  navigateTo,
  options: {
    enableOnFormTags: false,
  },
});

const getFarcasterBotCommands = (): CommandType[] => {
  if (cachedFarcasterBotCommands) return cachedFarcasterBotCommands;

  const addNewPostDraftWithSelectedCast = (draft: DraftType) => {
    const { selectedCast } = useDataStore.getState();
    if (!selectedCast) return;

    const { addNewPostDraft } = useDraftStore.getState();
    addNewPostDraft({
      ...draft,
      parentCastId: {
        fid: selectedCast.author.fid.toString(),
        hash: selectedCast.hash,
      },
    });

    const { openNewCastModal, setCastModalView } = useNavigationStore.getState();
    setCastModalView(CastModalView.Reply);
    openNewCastModal();
  };

  cachedFarcasterBotCommands = [
    createFarcasterBotCommand(
      'Feedback (send cast to @hellno)',
      () => useDraftStore.getState().addNewPostDraft(NewFeedbackPostDraft),
      '/post'
    ),
    createFarcasterBotCommand('Launch this cast on Launchcaster', () =>
      addNewPostDraftWithSelectedCast(LaunchCasterScoutDraft)
    ),
    createFarcasterBotCommand(
      'Post new bounty',
      () => useDraftStore.getState().addNewPostDraft(BountyCasterBotDraft),
      '/post'
    ),
    createFarcasterBotCommand('Remind me about this', () => addNewPostDraftWithSelectedCast(RemindMeBotDraft)),
    createFarcasterBotCommand('Pay user via paybot', () => addNewPostDraftWithSelectedCast(PayCasterBotPayDraft)),
    createFarcasterBotCommand('Request payment via paybot', () =>
      addNewPostDraftWithSelectedCast(PayCasterBotRequestDraft)
    ),
  ];

  return cachedFarcasterBotCommands;
};

export default function CommandPalette() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const { isCommandPaletteOpen, closeCommandPallete, toggleCommandPalette } = useNavigationStore();

  // Cache frequently accessed store data in refs for performance
  const accountStoreRef = useRef<any>(null);
  const lastChannelsLengthRef = useRef(0);
  const lastThemeRef = useRef<string>('');

  // Get theme and store data
  const { theme, setTheme } = useTheme();
  const { accounts, selectedAccountIdx } = useAccountStore();

  // Use only user's pinned channels instead of all channels for better performance
  const userChannels = accounts[selectedAccountIdx]?.channels || [];

  // Memoize expensive command generation with granular dependencies
  const themeCommands = useMemo(() => getThemeCommands(theme, setTheme), [theme, setTheme]);
  const navigationCommands = useMemo(() => getNavigationCommands({ router }), [router.pathname]);

  // Cache profile commands since they rarely change
  const profileCommands = useMemo(
    () => [
      {
        name: 'Your profile',
        action: () => {
          const state = useAccountStore.getState();
          const selectedAccountName = state.accounts[state.selectedAccountIdx].user?.username;
          router.push(`/profile/${selectedAccountName}`);
        },
        shortcut: 'cmd+shift+p',
        options: {
          enableOnFormTags: false,
        },
        icon: UserCircleIcon,
      },
      {
        name: 'Your Analytics',
        action: () => {
          const state = useAccountStore.getState();
          const fid = state.accounts[state.selectedAccountIdx]?.platformAccountId;
          const route = fid ? `/analytics?fid=${fid}` : '/analytics';
          router.push(route);
        },
        icon: ChartBarIcon,
      },
    ],
    [router]
  );

  // Only regenerate channel commands when user's pinned channels change
  const channelCommands = useMemo(() => {
    const currentChannelsLength = userChannels.length;
    if (lastChannelsLengthRef.current === currentChannelsLength && accountStoreRef.current) {
      return accountStoreRef.current.channelCommands || [];
    }

    const commands = getChannelCommands(useAccountStore.getState());
    lastChannelsLengthRef.current = currentChannelsLength;
    if (!accountStoreRef.current) accountStoreRef.current = {};
    accountStoreRef.current.channelCommands = commands;

    return commands;
  }, [userChannels.length]);

  // Get cached bot commands
  const farcasterBotCommands = useMemo(() => getFarcasterBotCommands(), []);

  // Optimized command assembly with minimal recreation
  const allCommands = useMemo(
    () => [
      ...channelCommands,
      ...navigationCommands,
      ...newPostCommands,
      ...accountCommands,
      ...themeCommands,
      ...profileCommands,
      ...farcasterBotCommands,
    ],
    [channelCommands, navigationCommands, themeCommands, profileCommands, farcasterBotCommands]
  );

  // Debounce search query for performance
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query]);

  // Track Command Palette opening performance
  const openTimingRef = useRef<string | null>(null);

  useHotkeys(
    'meta+k',
    () => {
      // Start timing when hotkey is pressed
      openTimingRef.current = startTiming('command-palette-open');
      console.log('🔥 Command Palette: Starting timer'); // Debug log
      toggleCommandPalette();
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [toggleCommandPalette]
  );

  const setupHotkeysForCommands = useCallback(
    (commands: CommandType[]) => {
      const currentPage = router.pathname.split('/')[1];

      // Group commands by shortcut to avoid duplicate registrations
      const shortcutToCommands = new Map<string, CommandType[]>();

      commands.forEach((command) => {
        if (!command.shortcut && !command.shortcuts) {
          return;
        }

        const shortcuts = (command.shortcuts || [command.shortcut])
          .map((s) => s?.replace('cmd', 'meta'))
          .filter((s): s is string => s !== undefined);

        shortcuts.forEach((shortcut) => {
          if (!shortcutToCommands.has(shortcut)) {
            shortcutToCommands.set(shortcut, []);
          }
          shortcutToCommands.get(shortcut)!.push(command);
        });
      });

      // Register each unique shortcut only once
      shortcutToCommands.forEach((commandsForShortcut, shortcut) => {
        useHotkeys(
          shortcut,
          () => {
            // Execute all commands for this shortcut (usually just one)
            commandsForShortcut.forEach((command) => {
              if (command.page && currentPage !== command.page) {
                return;
              }

              if (!command.enabled || (typeof command.enabled === 'function' && !command.enabled())) {
                return;
              }

              if (command.navigateTo) {
                router.push(command.navigateTo);
              }
              command.action();
            });
          },
          {
            delimiter: '-',
            preventDefault: true,
            enableOnFormTags: commandsForShortcut.some((cmd) => cmd.options?.enableOnFormTags),
            enableOnContentEditable: commandsForShortcut.some((cmd) => cmd.options?.enableOnContentEditable),
          },
          [commandsForShortcut, currentPage, router]
        );
      });
    },
    [router]
  );

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      setQuery('');
      setDebouncedQuery('');
    } else {
      // Modal just opened - complete the timing measurement
      if (openTimingRef.current) {
        console.log('🔥 Command Palette: Modal opened, ending timer'); // Debug log
        endTiming(openTimingRef.current, 50); // Target: <50ms
        openTimingRef.current = null;
      }
    }
  }, [isCommandPaletteOpen]);

  // Setup hotkeys for all commands with optimized memoization
  setupHotkeysForCommands(allCommands);

  const onClick = useCallback(
    (command: CommandType) => {
      if (!command) {
        return;
      }

      // Track command execution performance
      const timingId = startTiming('command-execution');
      console.log('⚡ Command Execution: Starting timer for:', command.name); // Debug log

      if (command.navigateTo) {
        router.push(command.navigateTo);
      }
      command.action();
      closeCommandPallete();

      // End timing after command executes
      setTimeout(() => {
        endTiming(timingId, 100); // Target: <100ms
        console.log('⚡ Command Execution: Completed'); // Debug log
      }, 0);
    },
    [router, closeCommandPallete]
  );

  const getWarpcastCommandForUrl = (url: string): CommandType => {
    const { slug, username, channel } = parseWarpcastUrl(url);
    const name = `Go to ${slug || username || channel} from Warpcast link`;

    return {
      name,
      action: () => {
        if (slug) {
          router.push(`/conversation/${slug}`);
        } else if (username) {
          router.push(`/profile/${username}`);
        } else if (channel) {
          setSelectedChannelByName(channel);
          router.push(`/feeds`);
        }
      },
      iconUrl: FARCASTER_LOGO_URL,
    };
  };

  const getSearchCommand = (query: string): CommandType => ({
    name: `Search${query && ` for ${query}`} in all casts`,
    action: () => {
      router.push(query ? `/search?q=${query}` : '/search');
    },
    icon: MagnifyingGlassCircleIcon,
  });

  const getFilteredCommands = useCallback(() => {
    // Only track search filtering if we have a query
    let timingId: string | null = null;
    if (debouncedQuery) {
      timingId = startTiming('command-search-filter');
      console.log('🔍 Command Search: Starting filter timer for query:', debouncedQuery); // Debug log
    }

    let result = allCommands.filter((command: CommandType) => {
      const namesToScore = [command.name, ...(command.aliases || [])];
      const scores = namesToScore.map((alias: string) => {
        return commandScore(alias, debouncedQuery);
      });
      return Math.max(...scores) > MIN_SCORE_THRESHOLD;
    });

    if (timingId) {
      endTiming(timingId, 20);
      console.log('🔍 Command Search: Filter completed'); // Debug log
    }

    if (isWarpcastUrl(debouncedQuery)) {
      result = [getWarpcastCommandForUrl(debouncedQuery), ...result];
    }

    if (debouncedQuery.startsWith('0x')) {
      result = [
        {
          name: `Go to cast ${debouncedQuery}`,
          action: () => {
            router.push(`/conversation/${debouncedQuery}`);
          },
        },
        ...result,
      ];
    }

    if (debouncedQuery.startsWith('@') || result.length === 0) {
      const profile = getProfile(useDataStore.getState(), debouncedQuery.slice(1));

      result = [
        {
          name: `Go to profile ${debouncedQuery}`,
          action: () => {
            router.push(`/profile/${debouncedQuery}`);
          },
          iconUrl: profile?.pfp_url,
          icon: UserCircleIcon,
        },
        getSearchCommand(debouncedQuery),
        ...result,
      ];
    }

    return result;
  }, [allCommands, debouncedQuery, router]);

  const filteredCommands = useMemo(() => getFilteredCommands(), [getFilteredCommands]);

  const renderIcon = useCallback((command: CommandType, active: boolean) => {
    if (command.iconUrl) {
      return (
        <Image
          src={command.iconUrl}
          alt=""
          width={20}
          height={20}
          className="mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
        />
      );
    }

    if (command.icon) {
      const IconComponent = command.icon as ComponentType<SVGProps<SVGSVGElement>>;
      return (
        <IconComponent
          className={cn('h-5 w-5 flex-none', active ? 'text-foreground' : 'text-foreground/80')}
          aria-hidden="true"
        />
      );
    }

    return <Skeleton className="mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full" />;
  }, []);

  const renderCommandItem = useCallback(
    (command: CommandType) => (
      <CommandItem
        key={command.name}
        value={command.name}
        onSelect={() => onClick(command)}
        className="flex items-center py-1.5 rounded-lg"
      >
        {renderIcon(command, false)}
        <span className="ml-2 flex-auto truncate">{command.name}</span>
        {command.shortcut && <CommandShortcut>{formatShortcut(command.shortcut)}</CommandShortcut>}
      </CommandItem>
    ),
    []
  );

  const renderDefaultCommands = () => (
    <CommandGroup heading="Suggestions">
      {[...profileCommands, getSearchCommand(debouncedQuery)].map(renderCommandItem)}
    </CommandGroup>
  );

  const renderFilteredCommands = () => (
    <CommandGroup heading="Commands">{filteredCommands.map(renderCommandItem)}</CommandGroup>
  );

  return (
    <CommandDialog open={isCommandPaletteOpen} onOpenChange={toggleCommandPalette} defaultOpen>
      <Command shouldFilter={false} loop>
        <CommandInput onValueChange={setQuery} autoFocus placeholder="Search Herocast..." />
        <CommandList className="">
          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">No command found.</CommandEmpty>
          {debouncedQuery ? renderFilteredCommands() : renderDefaultCommands()}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
