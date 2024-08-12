import React, { useMemo, useState, useCallback, ComponentType, SVGProps, useEffect } from "react";
import { CommandType } from "@/common/constants/commands";
import { accountCommands, getChannelCommands, useAccountStore } from "@/stores/useAccountStore";
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
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
} from "@/components/ui/command";
import { ChartBarIcon, MagnifyingGlassCircleIcon, UserCircleIcon } from "@heroicons/react/20/solid";
import Image from "next/image";
import commandScore from "command-score";
import { useHotkeys } from "react-hotkeys-hook";
import { useRouter } from "next/router";
import { getNavigationCommands } from "@/getNavigationCommands";
import { useTheme } from "next-themes";
import { getThemeCommands } from "@/getThemeCommands";
import { formatShortcut } from "@/common/helpers/text";
import { DraftType } from "@/common/constants/farcaster";
import { useDataStore } from "@/stores/useDataStore";
import { getProfile } from "@/common/helpers/profileUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { FARCASTER_LOGO_URL, isWarpcastUrl, parseWarpcastUrl } from "@/common/helpers/warpcast";
import { cn } from "@/lib/utils";

const MIN_SCORE_THRESHOLD = 0.0015;

export default function CommandPalette() {
    const router = useRouter();
    const [query, setQuery] = useState("");

    const { isCommandPaletteOpen, closeCommandPallete, toggleCommandPalette } = useNavigationStore();

    const { allChannels, setSelectedChannelUrl, setSelectedChannelByName } = useAccountStore();

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

    useEffect(() => {
        if (!isCommandPaletteOpen) {
            setQuery("");
        }
    }, [isCommandPaletteOpen]);

    const { theme, setTheme } = useTheme();
    const themeCommands = useCallback(() => getThemeCommands(theme, setTheme), [theme, setTheme])();
    const navigationCommands = useCallback(() => getNavigationCommands({ router }), [router])();
    const getProfileCommands = useCallback(() => {
        return [
            {
                name: "Your profile",
                action: () => {
                    const state = useAccountStore.getState();
                    const selectedAccountName = state.accounts[state.selectedAccountIdx].user?.username;
                    router.push(`/profile/${selectedAccountName}`);
                },
                shortcut: "cmd+shift+p",
                options: {
                    enableOnFormTags: false,
                },
                icon: UserCircleIcon,
            },
            {
                name: "Your Analytics",
                action: () => {
                    const state = useAccountStore.getState();
                    const fid = state.accounts[state.selectedAccountIdx]?.platformAccountId;
                    const route = fid ? `/analytics?fid=${fid}` : "/analytics";
                    router.push(route);
                },
                icon: ChartBarIcon,
            },
        ];
    }, [router]);

    const profileCommands = getProfileCommands();
    const channelCommands = useCallback(
        () => getChannelCommands(useAccountStore.getState()),
        [useAccountStore.getState()]
    )();

    const getCommands = useCallback((): CommandType[] => {
        let commands = [
            ...channelCommands,
            ...navigationCommands,
            ...newPostCommands,
            ...accountCommands,
            ...themeCommands,
            ...profileCommands,
        ];

        const nonHotkeyCommands: CommandType[] = [];

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

            const { openNewCastModal, setCastModalView } = useNavigationStore.getState();
            setCastModalView(CastModalView.Reply);
            openNewCastModal();
        };

        const createFarcasterBotCommand = (name: string, action: () => void, navigateTo?: string) => {
            return {
                name,
                action,
                navigateTo,
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
            createFarcasterBotCommand("Launch this cast on Launchcaster", launchCastAction),
            createFarcasterBotCommand("Post new bounty", postNewBountyAction, "/post"),
            createFarcasterBotCommand("Remind me about this", remindMeAction),
            createFarcasterBotCommand("Pay user via paybot", payCasterPayAction),
            createFarcasterBotCommand("Request payment via paybot", payCasterRequestAction),
        ];

        commands = commands.concat(farcasterBotCommands);
        commands = commands.concat(nonHotkeyCommands);
        return commands;
    }, [theme, setTheme, router, allChannels, setSelectedChannelUrl, setSelectedChannelByName]);

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
            router.push(query ? `/search?q=${query}` : "/search");
        },
        icon: MagnifyingGlassCircleIcon,
    });

    const getFilteredCommands = () => {
        let result = commands.filter((command: CommandType) => {
            const namesToScore = [command.name, ...(command.aliases || [])];
            const scores = namesToScore.map((alias: string) => {
                return commandScore(alias, query);
            });
            return Math.max(...scores) > MIN_SCORE_THRESHOLD;
        });

        if (isWarpcastUrl(query)) {
            result = [getWarpcastCommandForUrl(query), ...result];
        }

        if (query.startsWith("0x")) {
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

        if (query.startsWith("@") || result.length === 0) {
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
                getSearchCommand(query),
                ...result,
            ];
        }

        return result;
    };

    const filteredCommands = useMemo(
        () => getFilteredCommands(),
        [isCommandPaletteOpen, query, commands, router, setSelectedChannelByName]
    );

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
                    className={cn("h-5 w-5 flex-none", active ? "text-foreground" : "text-foreground/80")}
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
            {[...profileCommands, getSearchCommand(query)].map(renderCommandItem)}
        </CommandGroup>
    );

    const renderFilteredCommands = () => (
        <CommandGroup heading="Commands">{filteredCommands.map(renderCommandItem)}</CommandGroup>
    );

    return (
        <CommandDialog open={isCommandPaletteOpen} onOpenChange={toggleCommandPalette} defaultOpen>
            <Command shouldFilter loop>
                <CommandInput onValueChange={setQuery} autoFocus placeholder="Search Herocast..." />
                <CommandList className="">
                    <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                        No command found.
                    </CommandEmpty>
                    {query ? renderFilteredCommands() : renderDefaultCommands()}
                </CommandList>
            </Command>
        </CommandDialog>
    );
}
