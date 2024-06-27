import React, { useEffect, useState } from "react";

import { castTextStyle, classNames } from "../../src/common/helpers/css";
import { useAccountStore } from "../../src/stores/useAccountStore";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { localize, timeDiff } from "../../src/common/helpers/date";
import { CastThreadView } from "../../src/common/components/CastThreadView";
import isEmpty from "lodash.isempty";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import NewCastModal from "../../src/common/components/NewCastModal";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useDataStore } from "@/stores/useDataStore";
import { Loading } from "@/common/components/Loading";
import { CastType } from "@/common/constants/farcaster";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

enum NotificationTypeEnum {
  "cast-reply" = "cast-reply",
  "cast-mention" = "cast-mention",
}

type NotificationType = {
  hash: string;
  threadHash: string;
  parentHash: string;
  parentUrl: string;
  parentAuthor: {
    fid: string;
  };
  author: {
    fid: string;
    username: string;
    displayName: string;
    pfp: {
      url: string;
    };
  };
  text: string;
  timestamp: string;
  embeds: [];
  type: NotificationTypeEnum;
  reactions: {
    count: number;
    fids: string[];
  };
  recasts: {
    count: number;
    fids: string[];
  };
};

enum NotificationNavigationEnum {
  mentions = "mentions",
  reactions = "reactions",
}

const Notifications = () => {
  const {
    isNewCastModalOpen,
    setCastModalView,
    openNewCastModal,
    closeNewCastModal,
  } = useNavigationStore();

  const [navigation, setNavigation] = useState<NotificationNavigationEnum>(
    NotificationNavigationEnum.mentions
  );
  const [notifications, setNotifications] = useState<CastWithInteractions[]>(
    []
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedNotificationIdx, setSelectedNotificationIdx] =
    useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] =
    useState<boolean>(true);
  const [selectedParentCast, setSelectedParentCast] = useState<CastType | null>(
    null
  );
  const { selectedCast, updateSelectedCast } = useDataStore();

  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.platformAccountId
  );
  const now = new Date();

  useEffect(() => {
    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
    };
  }, []);

  useEffect(() => {
    if (!viewerFid) return;

    const loadData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      const resp = await neynarClient.fetchMentionAndReplyNotifications(
        Number(viewerFid),
        {
          viewerFid: Number(viewerFid),
          limit: 15,
        }
      );
      if (resp.result.notifications) {
        setNotifications(resp.result.notifications);
      }
      setIsLoading(false);
    };

    loadData();

    closeNewCastModal();
    setIsLeftColumnSelected(true);
    setSelectedNotificationIdx(0);
  }, [viewerFid]);

  console.log('notifications', notifications)

  const onReply = () => {
    setCastModalView(CastModalView.Reply);
    openNewCastModal();
  };

  const onQuote = () => {
    setCastModalView(CastModalView.Quote);
    openNewCastModal();
  };

  useHotkeys("r", onReply, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys("q", onQuote, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys(
    ["tab", "shift+tab"],
    () => {
      setIsLeftColumnSelected(!isLeftColumnSelected);
    },
    [isLeftColumnSelected],
    {
      enabled: !isNewCastModalOpen,
      preventDefault: true,
    }
  );

  useHotkeys(
    ["l", "o", Key.Enter, Key.ArrowRight],
    () => {
      setIsLeftColumnSelected(false);
    },
    [isLeftColumnSelected],
    {
      enabled: !isNewCastModalOpen,
      preventDefault: true,
    }
  );

  useHotkeys(
    ["h", Key.Escape, Key.ArrowLeft],
    () => {
      setIsLeftColumnSelected(true);
    },
    [isLeftColumnSelected],
    {
      enabled: !isNewCastModalOpen,
      preventDefault: true,
    }
  );

  const renderNotificationRow = (item: NotificationType, idx: number) => {
    const timeAgo = timeDiff(now, new Date(item.timestamp));
    const timeAgoStr = localize(timeAgo[0], timeAgo[1]);
    return (
      <li
        key={`notification-${item.hash}-${item.timestamp}`}
        onClick={() => setSelectedNotificationIdx(idx)}
        className={classNames(
          idx === selectedNotificationIdx
            ? "bg-muted"
            : "cursor-pointer bg-background/80 hover:bg-muted/10",
          "flex gap-x-4 px-5 py-4 rounded-lg"
        )}
      >
        <img
          className="mt-1.5 rounded-lg h-10 w-10 flex-none bg-background"
          src={item.author.pfp.url}
          alt=""
        />

        <div className="flex-auto">
          <div className="flex items-center justify-between gap-x-4">
            <p className="text-sm font-semibold leading-6 text-foreground/80">
              {item.author.username}
              <span className="ml-1 text-foreground/70 break-words">
                {item.type === NotificationTypeEnum["cast-reply"]
                  ? "replied"
                  : "mentioned you"}
              </span>
            </p>
            <p className="flex-none text-xs text-foreground/70">
              <time dateTime={item.timestamp}>{timeAgoStr}</time>
            </p>
          </div>
          <p
            className="mt-1 line-clamp-3 text-sm text-foreground/80 break-words lg:break-normal"
            style={castTextStyle}
          >
            {item.text}
          </p>
        </div>
      </li>
    );
  };

  const renderLeftColumn = () => {
    return (
      <div className="divide-y divide-white/5">
        <SelectableListWithHotkeys
          data={notifications}
          selectedIdx={selectedNotificationIdx}
          setSelectedIdx={setSelectedNotificationIdx}
          renderRow={(item: NotificationType, idx: number) =>
            renderNotificationRow(item, idx)
          }
          onSelect={(idx) => setSelectedNotificationIdx(idx)}
          onExpand={() => null}
          isActive={isLeftColumnSelected && !isNewCastModalOpen}
          disableScroll
        />
      </div>
    );
  };

  const renderMainContent = () => {
    return !isEmpty(selectedParentCast) ? (
      <div className="">
        <CastThreadView
          cast={{
            hash: selectedParentCast.hash,
            author: selectedParentCast.author,
          }}
          isActive={!isLeftColumnSelected}
          setSelectedCast={(cast) => {
            updateSelectedCast(cast);
          }}
        />
      </div>
    ) : null;
  };

  useEffect(() => {
    if (selectedNotificationIdx !== -1) {
      const notification = notifications[selectedNotificationIdx];
      const hash =
        notification?.threadHash ||
        notification?.parentHash ||
        notification?.hash;

      const author = notification?.author;
      if (!hash) return;

      setSelectedParentCast({ hash, author });
      updateSelectedCast(notification);
    }
  }, [selectedNotificationIdx, isLoading]);

  const renderReplyModal = () => (
    <NewCastModal
      open={isNewCastModalOpen}
      setOpen={(isOpen) => (isOpen ? openNewCastModal() : closeNewCastModal())}
      linkedCast={selectedCast}
    />
  );

  const renderNotificationFilterDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Filter
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Filter by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Power Badge</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>All</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen min-w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <main className="grid flex-1 items-start gap-4 px-4 md:px-2 lg:px-0">
          <Tabs defaultValue="mentions">
            <div className="flex items-center md:mx-2">
              <TabsList>
                <TabsTrigger value="mentions">Mentions</TabsTrigger>
                <TabsTrigger value="likes">Likes</TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                {/* {renderNotificationFilterDropdown()} */}
                {/* 
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Export
                    </span>
                  </Button>
                */}
              </div>
            </div>
            <TabsContent value="mentions">
              <div className="mx-auto flex w-full max-w-7xl items-start">
                <div className="block w-full md:w-4/12 lg:6/12 shrink-0">
                  <div
                    className={classNames(
                      "overflow-hidden rounded-lg border",
                      isLeftColumnSelected
                        ? "border-gray-400"
                        : "border-gray-600"
                    )}
                  >
                    {renderLeftColumn()}
                  </div>
                </div>
                <main
                  className={classNames(
                    "hidden md:block rounded-r-lg flex-1 border-r border-t",
                    !isLeftColumnSelected
                      ? "border-gray-400"
                      : "border-gray-600"
                  )}
                >
                  {renderMainContent()}
                </main>
              </div>
            </TabsContent>
            <TabsContent value="likes"></TabsContent>
          </Tabs>
          {isLoading && (
            <div className="text-foreground flex-1 flex items-center justify-center">
              <Loading />
            </div>
          )}
        </main>
      </div>
      {renderReplyModal()}
    </div>
  );
};

export default Notifications;
