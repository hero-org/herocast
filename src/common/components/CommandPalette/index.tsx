import React, {
  Fragment,
  useMemo,
  useState,
  useCallback,
  ComponentType,
  SVGProps,
} from "react";
import { CommandType } from "@/common/constants/commands";
import { classNames } from "@/common/helpers/css";
import {
  accountCommands,
  channelCommands,
  useAccountStore,
} from "@/stores/useAccountStore";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";
import { newPostCommands, useDraftStore } from "@/stores/useDraftStore";
import {
  PayCasterBotPayDraft,
  PayCasterBotRequestDraft,
  RemindMeBotDraft,
  BountyCasterBotDraft,
  LaunchCasterScoutDraft,
  NewFeedbackPostDraft,
} from "@/common/constants/postDrafts";
import { Combobox, Dialog, Transition } from "@headlessui/react";
import {
  MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
} from "@heroicons/react/20/solid";
import { FaceSmileIcon } from "@heroicons/react/24/outline";
import commandScore from "command-score";
import { useHotkeys } from "react-hotkeys-hook";
import { useRouter } from "next/router";
import { getNavigationCommands } from "@/getNavigationCommands";
import { useTheme } from "next-themes";
import { getThemeCommands } from "@/getThemeCommands";
import { DraftType } from "@/common/constants/farcaster";
import { useDataStore } from "@/stores/useDataStore";
import { getProfile } from "@/common/helpers/profileUtils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FARCASTER_LOGO_URL,
  isWarpcastUrl,
  parseWarpcastUrl,
} from "@/common/helpers/warpcast";

const MIN_SCORE_THRESHOLD = 0.0015;

export default function CommandPalette() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { isCommandPaletteOpen, closeCommandPallete, toggleCommandPalette } =
    useNavigationStore();

  const { setSelectedChannelUrl, setSelectedChannelByName } = useAccountStore();

  useHotkeys(
    "meta+k",
    toggleCommandPalette,
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [toggleCommandPalette]
  );

  const setupHotkeysForCommands = useCallback(
    (commands: CommandType[]) => {
      const currentPage = router.pathname.split("/")[1];

      commands.forEach((command) => {
        if (!command.shortcut && !command.shortcuts) {
          return;
        }

        const shortcuts = (command.shortcuts || [command.shortcut])
          .map((s) => s?.replace("cmd", "meta"))
          .filter((s): s is string => s !== undefined);

        useHotkeys(
          shortcuts,
          () => {
            if (command.page && currentPage !== command.page) {
              return;
            }

            if (command.navigateTo) {
              router.push(command.navigateTo);
            }
            command.action();
          },
          {
            ...(command.options || {}),
            splitKey: "-",
            enabled: command.enabled,
            preventDefault: true,
          },
          [command.action, command.navigateTo, currentPage, router]
        );
      });
    },
    [router]
  );

  const { theme, setTheme } = useTheme();

  const getCommands = useCallback((): CommandType[] => {
    const themeCommands = getThemeCommands(theme, setTheme);
    const navigationCommands = getNavigationCommands({ router });
    const profileCommands = [
      {
        name: "Your profile",
        action: () => {
          const state = useAccountStore.getState();
          const selectedAccountName =
            state.accounts[state.selectedAccountIdx].user?.username;
          router.push(`/profile/${selectedAccountName}`);
        },
        shortcut: "cmd+shift+p",
        aliases: [],
        options: {
          enableOnFormTags: false,
        },
      },
    ];

    let commands = [
      ...navigationCommands,
      ...newPostCommands,
      ...accountCommands,
      ...channelCommands,
      ...themeCommands,
      ...profileCommands,
    ];

    const nonHotkeyCommands: CommandType[] = [];
    // allChannels.map((channel) => {
    //   nonHotkeyCommands.push({
    //     name: `${channel.name} channel (${formatLargeNumber(
    //       channel.data?.followerCount
    //     )})`,
    //     action: () => {
    //       setSelectedChannelUrl(channel.url);
    //     },
    //     shortcut: "",
    //     aliases: ["/" + channel.name.split("/").pop()],
    //     options: {
    //       enableOnFormTags: false,
    //     },
    //     iconUrl: channel.icon_url,
    //     data: channel.data,
    //     page: "feeds",
    //   });
    // });

    const addNewPostDraftWithSelectedCast = (draft: DraftType) => {
      const { selectedCast } = useDataStore.getState();
      if (!selectedCast) {
        return;
      }
      const { addNewPostDraft } = useDraftStore.getState();
      addNewPostDraft({
        ...draft,
        parentCastId: {
          fid: selectedCast.author.fid.toString(),
          hash: selectedCast.hash,
        },
      });

      const { openNewCastModal, setCastModalView } =
        useNavigationStore.getState();
      setCastModalView(CastModalView.Reply);
      openNewCastModal();
    };

    const createFarcasterBotCommand = (
      name: string,
      action: () => void,
      navigateTo?: string
    ) => {
      return {
        name,
        action,
        navigateTo,
        aliases: [],
        options: {
          enableOnFormTags: false,
        },
      };
    };

    const launchCastAction = () => {
      addNewPostDraftWithSelectedCast(LaunchCasterScoutDraft);
    };

    const payCasterPayAction = () => {
      addNewPostDraftWithSelectedCast(PayCasterBotPayDraft);
    };

    const payCasterRequestAction = () => {
      addNewPostDraftWithSelectedCast(PayCasterBotRequestDraft);
    };

    const postNewBountyAction = () => {
      const { addNewPostDraft } = useDraftStore.getState();
      addNewPostDraft(BountyCasterBotDraft);
    };

    const remindMeAction = () => {
      addNewPostDraftWithSelectedCast(RemindMeBotDraft);
    };

    const farcasterBotCommands: CommandType[] = [
      createFarcasterBotCommand(
        "Feedback (send cast to @hellno)",
        () => useDraftStore.getState().addNewPostDraft(NewFeedbackPostDraft),
        "/post"
      ),
      createFarcasterBotCommand(
        "Launch this cast on Launchcaster",
        launchCastAction
      ),
      createFarcasterBotCommand(
        "Post new bounty",
        postNewBountyAction,
        "/post"
      ),
      createFarcasterBotCommand("Remind me about this", remindMeAction),
      createFarcasterBotCommand("Pay user via paybot", payCasterPayAction),
      createFarcasterBotCommand(
        "Request payment via paybot",
        payCasterRequestAction
      ),
    ];

    commands = commands.concat(farcasterBotCommands);
    commands = commands.concat(nonHotkeyCommands);
    return commands;
  }, [
    theme,
    setTheme,
    router,
    setSelectedChannelUrl,
    setSelectedChannelByName,
  ]);

  const commands = useMemo(() => getCommands(), [getCommands]);
  setupHotkeysForCommands(commands);

  const onClick = useCallback(
    (command: CommandType) => {
      if (!command) {
        return;
      }
      if (command.navigateTo) {
        router.push(command.navigateTo);
      }
      command.action();
      closeCommandPallete();
    },
    [router, closeCommandPallete]
  );

  const getWarpcastCommandForUrl = (url: string): CommandType => {
    const { slug, username, channel } = parseWarpcastUrl(url);
    const name = `Go to ${slug || username || channel} from Warpcast link`;

    return {
      name,
      aliases: [],
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

  const getFilteredCommands = useCallback(() => {
    let result = commands
      .map((command: CommandType) => {
        const namesToScore = [command.name, ...(command.aliases || [])];
        const scores = namesToScore.map((alias: string) => {
          return commandScore(alias, query);
        });
        return {
          ...command,
          score: Math.max(...scores),
        };
      })
      .filter((command: CommandType & { score: number }) => {
        return command.score > MIN_SCORE_THRESHOLD;
      })
      // if there are channels in the commands we should rank them by follower count
      .sort((a, b) => {
        if (a.data?.followerCount && b.data?.followerCount) {
          return b.data.followerCount - a.data.followerCount;
        }
        return 0;
      })
      .slice(0, 25);

    if (isWarpcastUrl(query)) {
      result = [getWarpcastCommandForUrl(query), ...result];
    }

    const showCastHashCommand = query.startsWith("0x");
    if (showCastHashCommand) {
      result = [
        {
          name: `Go to cast ${query}`,
          action: () => {
            router.push(`/conversation/${query}`);
          },
        },
        ...result,
      ];
    }

    const showProfileCommand = query.startsWith("@") || result.length === 0;
    if (showProfileCommand) {
      const profile = getProfile(useDataStore.getState(), query.slice(1));

      result = [
        {
          name: `Go to profile ${query}`,
          action: () => {
            router.push(`/profile/${query}`);
          },
          iconUrl: profile?.pfp_url,
          icon: UserCircleIcon,
        },
        {
          name: `Search for ${query} in all casts`,
          action: () => {
            router.push(`/search?q=${query}`);
          },
          icon: MagnifyingGlassCircleIcon,
        },
        ...result,
      ];
    }

    return result;
  }, [query, commands, router, setSelectedChannelByName]);

  const filteredCommands = useMemo(
    () => (query?.length ? getFilteredCommands() : []),
    [query, getFilteredCommands]
  );

  const renderIcon = useCallback((command: CommandType, active: boolean) => {
    if (command.iconUrl) {
      return (
        <img
          src={command.iconUrl}
          alt=""
          className="mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
        />
      );
    }

    if (command.icon) {
      const IconComponent = command.icon as ComponentType<
        SVGProps<SVGSVGElement>
      >;
      return (
        <IconComponent
          className={classNames(
            "h-5 w-5 flex-none",
            active ? "text-foreground" : "text-foreground/80"
          )}
          aria-hidden="true"
        />
      );
    }

    return (
      <Skeleton className="mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full" />
    );
  });

  return (
    <Transition.Root
      show={isCommandPaletteOpen}
      as={Fragment}
      afterLeave={() => setQuery("")}
      appear
    >
      <Dialog as="div" className="relative z-50" onClose={toggleCommandPalette}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-10"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-10"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-muted/95 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 sm:pt-20 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-10"
            enterFrom="opacity-50 scale-98"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-10"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-98"
          >
            <Dialog.Panel className="mx-auto max-w-2xl transform divide-y divide-gray-500 divide-opacity-20 overflow-hidden rounded-lg bg-background shadow-lg border border-border transition-all">
              <Combobox
                onChange={(e: any) => {
                  onClick(e);
                }}
              >
                <div className="relative">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-foreground/80"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-foreground focus:outline-none focus:ring focus:border-gray-500 sm:text-sm"
                    placeholder="Search Herocast..."
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                {(query === "" || filteredCommands.length > 0) && (
                  <Combobox.Options
                    static
                    className="max-h-80 scroll-py-2 divide-y divide-gray-500 divide-opacity-20 overflow-y-auto"
                  >
                    <ul className="mt-2 text-sm text-foreground/70">
                      {(
                        (filteredCommands.length > 0 && filteredCommands) ||
                        commands.slice(0, 7)
                      ).map((command) => (
                        <Combobox.Option
                          key={command.name}
                          value={command}
                          onClick={() => onClick(command)}
                          className={({ active }) =>
                            classNames(
                              "flex cursor-default select-none items-center rounded-sm px-3 py-2",
                              active
                                ? "bg-foreground/5 text-foreground"
                                : "text-foreground/80"
                            )
                          }
                        >
                          {({ active }) => (
                            <>
                              {renderIcon(command, active)}
                              <span className="ml-3 flex-auto truncate">
                                {command.name}
                              </span>
                              {command.shortcut && (
                                <span className="ml-3 flex-none text-xs px-2 py-1 rounded-md bg-muted text-primary border-foreground/60">
                                  <kbd className="font-mono">
                                    {command.shortcut}
                                  </kbd>
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ))}
                    </ul>
                  </Combobox.Options>
                )}
                {query !== "" && filteredCommands.length === 0 && (
                  <div className="px-6 py-14 text-center sm:px-14">
                    <FaceSmileIcon
                      className="mx-auto h-6 w-6 text-foreground/80"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-sm text-muted-foreground">
                      nothing found - submit feedback if something should be
                      here
                    </p>
                  </div>
                )}
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
