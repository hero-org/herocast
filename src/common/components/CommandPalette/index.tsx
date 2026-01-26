'use client';

import {
  ArrowPathRoundedSquareIcon,
  ArrowsUpDownIcon,
  MagnifyingGlassCircleIcon,
  UserCircleIcon,
} from '@heroicons/react/20/solid';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import commandScore from 'command-score';
import { HeartIcon } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { type ComponentType, type SVGProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { findCommandByAlias } from '@/common/constants/commandAliases';
import type { CommandType } from '@/common/constants/commands';
import { NewFeedbackPostDraft } from '@/common/constants/postDrafts';
import { FARCASTER_LOGO_URL, isWarpcastUrl, parseWarpcastUrl } from '@/common/helpers/warpcast';
import { useRecentCommands } from '@/common/hooks/useRecentCommands';
import { hotkeyDefinitions } from '@/common/services/shortcuts/hotkeyDefinitions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { KeyboardShortcutSingle } from '@/components/ui/keyboard-shortcut-single';
import { getNavigationCommands } from '@/getNavigationCommands';
import { getThemeCommands } from '@/getThemeCommands';
import { cn } from '@/lib/utils';
import { accountCommands, getChannelCommands, useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';
import { newPostCommands, useDraftStore } from '@/stores/useDraftStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { endTiming, startTiming } from '@/stores/usePerformanceStore';
import { ChannelSearchCommand } from './ChannelSearchCommand';
import styles from './CommandPalette.module.css';
import { UserSearchCommand } from './UserSearchCommand';

const MIN_SCORE_THRESHOLD = 0.0015;

// Cache static commands that don't depend on user state
// eslint-disable-next-line prefer-const
const cachedStaticCommands: CommandType[] | null = null;
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

  cachedFarcasterBotCommands = [
    createFarcasterBotCommand(
      'Feedback (send cast to @hellno)',
      () => useDraftStore.getState().addNewPostDraft(NewFeedbackPostDraft),
      '/post'
    ),
  ];

  return cachedFarcasterBotCommands;
};

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const { addCommand, getRecentCommands, recentCommandNames } = useRecentCommands();
  const [lastQuery, setLastQuery] = useState('');
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);

  const { isCommandPaletteOpen, closeCommandPallete, toggleCommandPalette } = useNavigationStore();
  const eventCleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventCleanupRef.current) {
        eventCleanupRef.current();
      }
    };
  }, []);

  // Restore last query on open
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isCommandPaletteOpen) {
      const savedQuery = sessionStorage.getItem('commandPalette.lastQuery');
      if (savedQuery && Date.now() - parseInt(sessionStorage.getItem('commandPalette.lastTime') || '0') < 2000) {
        setQuery(savedQuery);
        setDebouncedQuery(savedQuery);
      }
    } else {
      sessionStorage.setItem('commandPalette.lastTime', Date.now().toString());
    }
  }, [isCommandPaletteOpen]);

  const { setSelectedChannelUrl, setSelectedChannelByName } = useAccountStore();

  // Cache frequently accessed store data in refs for performance
  const accountStoreRef = useRef<any>(null);
  const lastChannelsLengthRef = useRef(0);
  const lastThemeRef = useRef<string>('');

  // Get theme and store data
  const { theme, setTheme } = useTheme();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const { selectedCast } = useDataStore();

  // Use only user's pinned channels instead of all channels for better performance
  const userChannels = accounts[selectedAccountIdx]?.channels || [];

  // Remove hotkey registration from here - it will be handled at app level

  // Memoize expensive command generation with granular dependencies
  const themeCommands = useMemo(() => getThemeCommands(theme, setTheme), [theme, setTheme]);
  const navigationCommands = useMemo(() => getNavigationCommands({ router }), [pathname]);

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
    ],
    [router]
  );

  // Only regenerate channel commands when user's pinned channels change
  const channelCommands = useMemo(() => {
    const currentChannelsLength = userChannels.length;
    if (lastChannelsLengthRef.current === currentChannelsLength && accountStoreRef.current) {
      return accountStoreRef.current.channelCommands || [];
    }

    const commands = getChannelCommands(useAccountStore.getState(), router);
    lastChannelsLengthRef.current = currentChannelsLength;
    if (!accountStoreRef.current) accountStoreRef.current = {};
    accountStoreRef.current.channelCommands = commands;

    return commands;
  }, [userChannels.length]);

  // Get cached bot commands
  const farcasterBotCommands = useMemo(() => getFarcasterBotCommands(), []);

  // Get shortcuts as commands (only those not already in navigation/other commands)
  const shortcutCommands = useMemo(() => {
    // List of command names that have actual implementations elsewhere
    const implementedCommands = new Set([
      'Switch to Feeds',
      'Switch to Search',
      'Switch to Channels',
      'Notifications',
      'Settings',
      'Your Profile',
      'Your Analytics',
      'Create cast',
      'Reply',
    ]);

    return hotkeyDefinitions
      .filter((def) => !implementedCommands.has(def.name))
      .map((def) => ({
        name: def.name,
        shortcut: Array.isArray(def.keys) ? def.keys[0] : def.keys,
        shortcuts: Array.isArray(def.keys) ? def.keys : undefined,
        action: () => {}, // No-op action for shortcut definitions
        icon: def.icon,
        category: def.category,
      }));
  }, []);

  // Get dynamic shortcuts based on context
  const dynamicShortcuts = useMemo(() => {
    if (!selectedCast) return [];
    return [
      {
        name: `Like ${selectedCast.author.username}'s cast`,
        shortcut: 'l',
        action: () => {},
        icon: () => <span className="text-lg">❤️</span>,
      },
      {
        name: `Recast ${selectedCast.author.username}'s cast`,
        shortcut: 'shift+r',
        action: () => {},
        icon: () => <span className="text-lg">🔁</span>,
      },
      {
        name: `Reply to ${selectedCast.author.username}`,
        shortcut: 'r',
        action: () => {},
        icon: () => <span className="text-lg">💬</span>,
      },
    ];
  }, [selectedCast]);

  // Optimized command assembly with deduplication
  const allCommands = useMemo(() => {
    const commandMap = new Map<string, CommandType>();

    // Add commands in priority order (later additions override earlier ones)
    // Commands with actual actions should come after shortcut definitions
    const commandArrays = [
      shortcutCommands, // These are just definitions without actions
      dynamicShortcuts,
      farcasterBotCommands,
      profileCommands,
      themeCommands,
      accountCommands,
      newPostCommands,
      navigationCommands, // These have actual navigation actions
      channelCommands, // These have actual channel switching actions
    ];

    commandArrays.forEach((commands) => {
      commands.forEach((cmd) => {
        if (cmd.name) {
          commandMap.set(cmd.name, cmd);
        }
      });
    });

    return Array.from(commandMap.values());
  }, [
    shortcutCommands,
    channelCommands,
    navigationCommands,
    themeCommands,
    profileCommands,
    farcasterBotCommands,
    dynamicShortcuts,
    newPostCommands,
    accountCommands,
  ]);

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

  const setupHotkeysForCommands = useCallback(
    (commands: CommandType[]) => {
      const currentPage = pathname.split('/')[1];

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
        // Smart detection of whether shortcut should work in form inputs
        const shouldEnableOnFormTags = (() => {
          // If any command explicitly requests it, honor that
          if (commandsForShortcut.some((cmd) => cmd.options?.enableOnFormTags)) {
            return true;
          }

          // Parse shortcut to check modifiers and key count
          const parts = shortcut
            .toLowerCase()
            .split('+')
            .map((p) => p.trim());
          const hasCmd = parts.includes('cmd') || parts.includes('meta');
          const hasCtrl = parts.includes('ctrl');
          const hasAlt = parts.includes('alt') || parts.includes('option');
          const hasShift = parts.includes('shift');

          // Count non-modifier keys
          const nonModifierKeys = parts.filter((p) => !['cmd', 'meta', 'ctrl', 'alt', 'option', 'shift'].includes(p));

          // Enable if: has Cmd/Ctrl/Alt (these don't interfere with typing)
          if (hasCmd || hasCtrl || hasAlt) {
            return true;
          }

          // Don't enable if: Shift + single key (e.g., Shift+A produces 'A' when typing)
          if (hasShift && nonModifierKeys.length === 1) {
            return false;
          }

          // Don't enable for single keys or easily typable combinations
          return false;
        })();

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
            enableOnFormTags: shouldEnableOnFormTags,
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

  // Remove old setupHotkeysForCommands function call

  const onClick = useCallback(
    (command: CommandType) => {
      if (!command) {
        return;
      }

      // Track command execution performance
      const timingId = startTiming('command-execution');
      console.log('⚡ Command Execution: Starting timer for:', command.name); // Debug log

      // Show executing state
      setExecutingCommand(command.name);

      // Track command usage
      addCommand(command);

      // Save query for persistence
      if (query && typeof window !== 'undefined') {
        sessionStorage.setItem('commandPalette.lastQuery', query);
      }

      // Execute immediately for snappy feel
      if (command.navigateTo) {
        router.push(command.navigateTo);
      }
      command.action();
      closeCommandPallete();

      // Reset executing state after a brief moment
      setTimeout(() => {
        setExecutingCommand(null);
      }, 50);

      // End timing after command executes
      setTimeout(() => {
        endTiming(timingId, 100); // Target: <100ms
        console.log('⚡ Command Execution: Completed'); // Debug log
      }, 0);
    },
    [router, closeCommandPallete, addCommand, query, setExecutingCommand]
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

    // Check for special search prefixes
    const isUserSearch = debouncedQuery.startsWith('@');
    const isChannelSearch = debouncedQuery.startsWith('/') && debouncedQuery.length > 1;

    // For special searches, only show relevant results
    if (isUserSearch || isChannelSearch) {
      if (timingId) {
        endTiming(timingId, 20);
      }
      return []; // Return empty for now, will be handled by special components
    }

    // First try to find exact alias match
    const aliasedName = findCommandByAlias(debouncedQuery);
    const aliasMatch = aliasedName
      ? allCommands.find((cmd) => cmd.name.toLowerCase() === aliasedName.toLowerCase())
      : null;

    let result = allCommands.filter((command: CommandType) => {
      const namesToScore = [command.name, ...(command.aliases || [])];
      const scores = namesToScore.map((alias: string) => {
        return commandScore(alias, debouncedQuery);
      });
      return Math.max(...scores) > MIN_SCORE_THRESHOLD;
    });

    // If we found an alias match, prioritize it
    if (aliasMatch && !result.find((cmd) => cmd.name === aliasMatch.name)) {
      result = [aliasMatch, ...result];
    }

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

    return result;
  }, [allCommands, debouncedQuery, router]);

  const filteredCommands = useMemo(() => getFilteredCommands(), [getFilteredCommands]);

  const renderIcon = useCallback((command: CommandType, active: boolean) => {
    if (command.iconUrl) {
      return (
        <Image
          src={command.iconUrl}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 flex-none rounded-full object-cover"
        />
      );
    }

    if (command.icon) {
      const IconComponent = command.icon as ComponentType<SVGProps<SVGSVGElement>>;
      return (
        <IconComponent
          className={cn('h-6 w-6 flex-none', active ? 'text-foreground' : 'text-foreground/70')}
          aria-hidden="true"
        />
      );
    }

    return <div className="h-6 w-6 flex-none rounded-full bg-muted" />;
  }, []);

  const renderCommandItem = (command: CommandType) => {
    // Only show single character for true single-key shortcuts (no modifiers)
    const SINGLE_KEY_SHORTCUTS = ['c', 'l', 'j', 'k', 'r', '/'];
    const isSingleLetterShortcut =
      command.shortcut &&
      SINGLE_KEY_SHORTCUTS.includes(command.shortcut.toLowerCase()) &&
      !command.shortcut.includes('+');

    return (
      <CommandItem
        key={command.name}
        value={command.name}
        onSelect={() => {
          // Only execute on Enter key or click, not on navigation
          // cmdk calls onSelect on Enter/Space/Click
          if (!command.keyboardOnly) {
            onClick(command);
          }
        }}
        className={cn(
          'flex items-center justify-between rounded-lg',
          styles.item,
          executingCommand === command.name && styles.executing,
          command.keyboardOnly && 'cursor-default opacity-75'
        )}
      >
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 flex items-center justify-center">{renderIcon(command, false)}</div>
          <span className="text-[18px] font-medium leading-tight">
            {command.name}
            {command.keyboardOnly && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">(keyboard only)</span>
            )}
          </span>
        </div>
        {executingCommand === command.name ? (
          <span className="ml-auto text-sm text-muted-foreground">Executing...</span>
        ) : (
          command.shortcut &&
          (isSingleLetterShortcut ? (
            // Large single-letter shortcuts like Superhuman
            <kbd className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-[16px] font-semibold text-foreground">
              {command.shortcut.toUpperCase()}
            </kbd>
          ) : (
            // For multi-key shortcuts, use the full shortcut display
            <KeyboardShortcutSingle shortcut={command.shortcut} size="lg" className="ml-auto" />
          ))
        )}
      </CommandItem>
    );
  };

  const renderDefaultCommands = () => {
    const recentCommands = getRecentCommands();
    const recentCommandItems = recentCommands
      .map((recent) => allCommands.find((cmd) => cmd.name === recent.commandName))
      .filter((cmd): cmd is CommandType => !!cmd)
      .slice(0, 3); // Reduced from 5 to 3

    // Show context-aware single-letter shortcuts when a cast is selected
    const contextShortcuts = selectedCast
      ? [
          { name: 'Like', shortcut: 'l', action: () => {}, icon: HeartIcon, keyboardOnly: true },
          { name: 'Reply', shortcut: 'r', action: () => {}, icon: ChatBubbleLeftIcon, keyboardOnly: true },
          { name: 'Recast', shortcut: 's', action: () => {}, icon: ArrowPathRoundedSquareIcon, keyboardOnly: true },
        ]
      : [];

    // Essential commands - show fewer to match Superhuman
    const essentialCommands = [
      ...newPostCommands.slice(0, 1), // Just "New Post"
      ...navigationCommands.slice(0, 2), // Top 2 navigation
    ];

    return (
      <>
        {recentCommandItems.length > 0 && (
          <>
            <CommandGroup heading="Recent" className={styles.commandGroup}>
              {recentCommandItems.map(renderCommandItem)}
            </CommandGroup>
            <div className={styles.categoryDivider} />
          </>
        )}

        {contextShortcuts.length > 0 && (
          <>
            <CommandGroup heading="Cast Actions" className={styles.commandGroup}>
              {contextShortcuts.map(renderCommandItem)}
            </CommandGroup>
            <div className={styles.categoryDivider} />
          </>
        )}

        <CommandGroup heading="Essentials" className={styles.commandGroup}>
          {essentialCommands.map(renderCommandItem)}
          {!selectedCast && (
            <CommandItem
              value="navigate-feed"
              data-hint="true"
              className={cn('flex items-center justify-between rounded-lg opacity-60 cursor-default', styles.item)}
              onSelect={() => {}}
            >
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 flex items-center justify-center">
                  <ArrowsUpDownIcon className="h-6 w-6 flex-none text-foreground/70" />
                </div>
                <span className="text-[18px] font-medium leading-tight text-muted-foreground">Navigate in feed</span>
              </div>
              <div className="flex gap-1.5">
                <kbd className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-[16px] font-semibold text-foreground">
                  J
                </kbd>
                <kbd className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-[16px] font-semibold text-foreground">
                  K
                </kbd>
              </div>
            </CommandItem>
          )}
        </CommandGroup>
      </>
    );
  };

  const renderFilteredCommands = () => {
    // Handle special search modes
    if (debouncedQuery.startsWith('@')) {
      return (
        <CommandGroup heading="Users" className={styles.commandGroup}>
          <UserSearchCommand query={debouncedQuery.slice(1)} />
        </CommandGroup>
      );
    }

    if (debouncedQuery.startsWith('/') && debouncedQuery.length > 1) {
      return (
        <CommandGroup heading="Channels" className={styles.commandGroup}>
          <ChannelSearchCommand query={debouncedQuery.slice(1)} />
        </CommandGroup>
      );
    }

    // Group commands by category
    const categorizedCommands = new Set<string>();
    const commandsByCategory: Record<string, CommandType[]> = {
      'Quick Actions': filteredCommands.filter((cmd) => {
        if (!cmd?.name) return false;
        // Hide quick actions on settings page
        if (pathname === '/settings') return false;
        const matches =
          newPostCommands.some((pc) => pc.name === cmd.name) ||
          cmd.name.includes('Create') ||
          cmd.name.includes('Search');
        if (matches) categorizedCommands.add(cmd.name);
        return matches;
      }),
      Navigation: filteredCommands.filter((cmd) => {
        if (!cmd?.name) return false;
        const matches = navigationCommands.some((nc) => nc.name === cmd.name);
        if (matches) categorizedCommands.add(cmd.name);
        return matches;
      }),
      Channels: filteredCommands.filter((cmd) => {
        if (!cmd?.name) return false;
        const matches = channelCommands.some((cc) => cc.name === cmd.name);
        if (matches) categorizedCommands.add(cmd.name);
        return matches;
      }),
      'Account & Settings': filteredCommands.filter((cmd) => {
        if (!cmd?.name) return false;
        const matches =
          accountCommands.some((ac) => ac.name === cmd.name) || themeCommands.some((tc) => tc.name === cmd.name);
        if (matches) categorizedCommands.add(cmd.name);
        return matches;
      }),
      'Keyboard Shortcuts': filteredCommands.filter((cmd) => {
        if (!cmd?.name) return false;
        const matches = shortcutCommands.some((sc) => sc.name === cmd.name);
        if (matches) categorizedCommands.add(cmd.name);
        return matches;
      }),
    };

    // Add uncategorized commands to 'Other'
    commandsByCategory['Other'] = filteredCommands.filter((cmd) => cmd?.name && !categorizedCommands.has(cmd.name));

    // Regular command search
    return (
      <>
        {Object.entries(commandsByCategory)
          .filter(([_, commands]) => commands.length > 0)
          .map(([category, commands], index) => (
            <div key={category}>
              {index > 0 && <div className={styles.categoryDivider} />}
              <CommandGroup heading={`${category} (${commands.length})`} className={styles.commandGroup}>
                {commands.map(renderCommandItem)}
              </CommandGroup>
            </div>
          ))}
        {/* Show channel search for queries >= 2 chars */}
        {query && query.length >= 2 && !debouncedQuery.startsWith('@') && !debouncedQuery.startsWith('/') && (
          <CommandGroup heading="Search Channels" className={styles.commandGroup}>
            <ChannelSearchCommand query={query} />
          </CommandGroup>
        )}
      </>
    );
  };

  return (
    <Dialog open={isCommandPaletteOpen} onOpenChange={toggleCommandPalette}>
      <DialogContent className={cn('overflow-hidden p-0', styles.dialogContent)}>
        <Command
          shouldFilter={false}
          loop
          className={cn(
            styles.palette,
            '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5'
          )}
          onKeyDown={(e) => {
            // Handle vim-style navigation
            if ((e.key === 'j' || e.key === 'k') && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              e.stopPropagation();

              // Find the input and dispatch arrow key from there
              const input = e.currentTarget.querySelector('input[cmdk-input]');
              if (input) {
                const arrowEvent = new KeyboardEvent('keydown', {
                  key: e.key === 'j' ? 'ArrowDown' : 'ArrowUp',
                  bubbles: true,
                  cancelable: true,
                });

                input.dispatchEvent(arrowEvent);
              }
            }
          }}
        >
          <CommandInput
            onValueChange={setQuery}
            autoFocus
            placeholder="Search commands, @ for users, / for channels..."
            className={cn(styles.input, 'text-base')}
          />
          <CommandList className={cn(styles.scrollContainer)}>
            <CommandEmpty className="py-8 text-center text-muted-foreground">
              <div className="space-y-3">
                <p className="text-base font-medium">No command found</p>
                <p className="text-sm">
                  Tip: Try @ for users, / for channels, or common actions like &quot;new post&quot;
                </p>
              </div>
            </CommandEmpty>
            {debouncedQuery ? renderFilteredCommands() : renderDefaultCommands()}
          </CommandList>
          <div className={styles.footer}>
            <span>↑↓ j/k Navigate</span>
            <span>↵ Select</span>
            <span>? All Shortcuts</span>
            <span>ESC Close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
