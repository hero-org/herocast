import React, { useEffect, useMemo, useState } from "react";

import { castTextStyle, classNames } from "../../src/common/helpers/css";
import { useAccountStore } from "../../src/stores/useAccountStore";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { localize, timeDiff } from "../../src/common/helpers/date";
import isEmpty from "lodash.isempty";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from "ts-key-enum";
import NewCastModal from "../../src/common/components/NewCastModal";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import {
  CastWithInteractions,
  Notification,
  NotificationTypeEnum,
  ReactionWithUserInfo,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useDataStore } from "@/stores/useDataStore";
import { Loading } from "@/common/components/Loading";
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";
import orderBy from "lodash.orderby";
import { Button } from "@/components/ui/button";
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
import { CastRow } from "@/common/components/CastRow";
import SkeletonCastRow from "@/common/components/SkeletonCastRow";
import ProfileInfo from "@/common/components/Sidebar/ProfileInfo";

const DEFAULT_SHOW_REACTIONS_LIMIT = 15;

enum NotificationTab {
  all = "all",
  mentions = "mentions",
  replies = "replies",
  likes = "likes",
  recasts = "recasts",
  follows = "follows",
}

const notificationTabToType = (tab: NotificationTab) => {
  switch (tab) {
    case NotificationTab.mentions:
      return NotificationTypeEnum.Mention;
    case NotificationTab.likes:
      return NotificationTypeEnum.Likes;
    case NotificationTab.follows:
      return NotificationTypeEnum.Follows;
    case NotificationTab.replies:
      return NotificationTypeEnum.Reply;
    case NotificationTab.recasts:
      return NotificationTypeEnum.Recasts;
    case NotificationTab.all:
    default:
      return undefined;
  }
};

const filterNotificationsByActiveTab = (
  notifications: Notification[],
  selectedTab: NotificationTab
) => {
  const notificationType = notificationTabToType(selectedTab);
  if (!notificationType) return notifications;

  return notifications.filter(
    (notification) => notification.type === notificationType
  );
};

const Notifications = () => {
  const {
    isNewCastModalOpen,
    setCastModalView,
    openNewCastModal,
    closeNewCastModal,
  } = useNavigationStore();

  const selectedAccount = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const [allNotifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedNotificationIdx, setSelectedNotificationIdx] =
    useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] =
    useState<boolean>(true);
  const [parentCastHash, setParentCastHash] = useState<string>();
  const [parentCast, setParentCast] = useState<CastWithInteractions>();
  const { selectedCast, updateSelectedCast } = useDataStore();
  const [loadMoreCursor, setLoadMoreCursor] = useState<string>();
  const [activeTab, setActiveTab] = useState<NotificationTab>(
    NotificationTab.all
  );
  const [showReactionsLimit, setShowReactionsLimit] = useState<number>(
    DEFAULT_SHOW_REACTIONS_LIMIT
  );
  const viewerFid = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.platformAccountId
  );
  const now = new Date();
  const notifications = useMemo(
    () => filterNotificationsByActiveTab(allNotifications, activeTab),
    [allNotifications, activeTab]
  );

  console.log("notif", notifications);

  useEffect(() => {
    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    const resp = await neynarClient.fetchAllNotifications(Number(viewerFid), {
      cursor: loadMoreCursor,
    });
    if (resp.notifications) {
      setNotifications([...allNotifications, ...resp.notifications]);
      setLoadMoreCursor(resp.next.cursor);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!viewerFid) return;
    setLoadMoreCursor(undefined);

    loadData();

    closeNewCastModal();
    setIsLeftColumnSelected(true);
    setSelectedNotificationIdx(0);
  }, [viewerFid]);

  useEffect(() => {
    setSelectedNotificationIdx(0);
  }, [activeTab]);

  useEffect(() => {
    if (parentCastHash) {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      neynarClient
        .fetchBulkCasts([parentCastHash], { viewerFid: Number(viewerFid) })
        .then((resp) => {
          setParentCast(resp.result.casts[0]);
        })
        .catch((err) => {
          console.error(`Error fetching parent cast: ${err}`);
        });
    }
  }, [parentCastHash]);

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

  useHotkeys("shift+1", () => setActiveTab(NotificationTab.all), [], {});
  useHotkeys("shift+2", () => setActiveTab(NotificationTab.replies), [], {});
  useHotkeys("shift+3", () => setActiveTab(NotificationTab.mentions), [], {});
  useHotkeys("shift+4", () => setActiveTab(NotificationTab.likes), [], {});
  useHotkeys("shift+5", () => setActiveTab(NotificationTab.recasts), [], {});
  useHotkeys("shift+6", () => setActiveTab(NotificationTab.follows), [], {});

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

  const getActionDescriptionForRow = (notification: Notification): string => {
    switch (notification.type) {
      case NotificationTypeEnum.Reply:
        return `@${notification.cast.author.username} replied`;
      case NotificationTypeEnum.Mention:
        return `@${notification.cast.author.username} mentioned you`;
      case NotificationTypeEnum.Likes:
        return `Received ${notification.reactions?.length} likes`;
      case NotificationTypeEnum.Follows:
        return `${notification.follows?.length} new followers`;
      case NotificationTypeEnum.Recasts:
        return `Received ${notification.reactions?.length} recasts`;
      default:
        return "";
    }
  };

  const renderNotificationRow = (notification: Notification, idx: number) => {
    const { cast } = notification;

    const timeAgo = timeDiff(now, new Date(notification.most_recent_timestamp));
    const timeAgoStr = localize(timeAgo[0], timeAgo[1]);

    const actionDescription = getActionDescriptionForRow(notification);
    const author =
      notification.type !== NotificationTypeEnum.Follows
        ? cast?.author
        : selectedAccount.user;

    return (
      <li
        key={`item-${notification.most_recent_timestamp}`}
        onClick={() => setSelectedNotificationIdx(idx)}
        className={classNames(
          idx === selectedNotificationIdx
            ? "bg-muted"
            : "cursor-pointer bg-background/80 hover:bg-muted/10",
          "flex gap-x-4 px-5 py-4 border-b border-muted"
        )}
      >
        <img
          className="mt-1.5 rounded-lg h-10 w-10 flex-none bg-background"
          src={author?.pfp_url}
          alt=""
        />

        <div className="flex-auto">
          <div className="flex items-center justify-between gap-x-4">
            <p className="text-sm leading-6 text-foreground">
              {actionDescription}
            </p>
            <p className="flex-none text-xs text-foreground/50">
              <time dateTime={timeAgoStr}>{timeAgoStr}</time>
            </p>
          </div>
          {cast?.text && (
            <p
              className="mt-1 line-clamp-3 text-sm text-foreground/80 break-words lg:break-normal"
              style={castTextStyle}
            >
              {cast.text}
            </p>
          )}
        </div>
      </li>
    );
  };

  const renderLoadMoreButton = () => (
    <div className="flex justify-center my-8">
      <Button
        variant="outline"
        size="lg"
        disabled={isLoading}
        onClick={() => loadData()}
      >
        Load More
      </Button>
    </div>
  );

  const renderShowMoreReactionsButton = () => (
    <div className="flex justify-center my-8">
      <Button
        variant="outline"
        size="lg"
        disabled={isLoading}
        onClick={() => setShowReactionsLimit(showReactionsLimit + 15)}
      >
        Show More
      </Button>
    </div>
  );

  const renderLeftColumn = () => {
    return (
      <div key={`left-column-${activeTab}`} className="divide-y divide-white/5">
        <SelectableListWithHotkeys
          data={notifications}
          selectedIdx={selectedNotificationIdx}
          setSelectedIdx={setSelectedNotificationIdx}
          renderRow={(item: Notification, idx: number) =>
            renderNotificationRow(item, idx)
          }
          onSelect={(idx) => setSelectedNotificationIdx(idx)}
          onExpand={() => null}
          isActive={isLeftColumnSelected && !isNewCastModalOpen}
          disableScroll
        />
        <div>{renderLoadMoreButton()}</div>
      </div>
    );
  };

  const renderProfilesFromReactions = (reactions?: ReactionWithUserInfo[]) => {
    if (!reactions) return null;

    const reactionFids = orderBy(reactions, ["user.follower_count"], ["desc"])
      .slice(0, showReactionsLimit)
      .map((reaction) => reaction.user.fid);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 items-center">
        {reactionFids &&
          reactionFids.map((fid) => (
            <div
              key={fid}
              className="flex self-start h-full gap-2 p-2 border border-muted/50"
            >
              <ProfileInfo
                fid={fid}
                viewerFid={Number(viewerFid)}
                showFollowButton
              />
            </div>
          ))}
        {reactions.length > showReactionsLimit &&
          renderShowMoreReactionsButton()}
      </div>
    );
  };

  const renderMainContent = () => {
    if (isEmpty(notifications)) return null;

    const notification = notifications[selectedNotificationIdx];
    if (!notification) return null;

    const notificationType = notification.type;
    return (
      <div className="min-h-full h-full">
        {notificationType === NotificationTypeEnum.Reply && (
          <div className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full">
            {parentCast ? (
              <CastRow cast={parentCast} showChannel />
            ) : (
              <SkeletonCastRow />
            )}
          </div>
        )}
        <div className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full">
          {selectedCast && <CastRow cast={selectedCast} showChannel />}
        </div>
        {(notificationType === NotificationTypeEnum.Likes ||
          notificationType === NotificationTypeEnum.Recasts) && (
          <div className="mt-4 ml-8 max-w-full">
            {renderProfilesFromReactions(notification.reactions)}
          </div>
        )}
        {notificationType === NotificationTypeEnum.Follows && (
          <div className="mt-4 ml-8 max-w-full">
            {renderProfilesFromReactions(notification.follows)}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!isEmpty(notifications) && selectedNotificationIdx > -1) {
      const notification = notifications[selectedNotificationIdx];

      if (!notification) return;

      if (notification.type === NotificationTypeEnum.Reply) {
        const hash = notification?.cast?.parent_hash;
        if (hash) {
          setParentCastHash(hash);
        }
      } else {
        setParentCastHash(undefined);
      }
      updateSelectedCast(notification.cast);
    }
  }, [notifications, selectedNotificationIdx, isLoading]);

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
          <Tabs
            defaultValue={NotificationTab.all}
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as NotificationTab)}
          >
            <div className="flex items-center md:mx-2">
              <TabsList>
                <TabsTrigger className="flex col-span-1" value={NotificationTab.all}>
                  All
                </TabsTrigger>
                <TabsTrigger
                  className="col-span-1"
                  value={NotificationTab.replies}
                >
                  Replies
                </TabsTrigger>
                <TabsTrigger
                  className="col-span-1"
                  value={NotificationTab.mentions}
                >
                  Mentions
                </TabsTrigger>
                <TabsTrigger
                  className="col-span-1"
                  value={NotificationTab.likes}
                >
                  Likes
                </TabsTrigger>
                <TabsTrigger
                  className="col-span-1"
                  value={NotificationTab.recasts}
                >
                  Recasts
                </TabsTrigger>
                <TabsTrigger
                  className="col-span-1"
                  value={NotificationTab.follows}
                >
                  Follows
                </TabsTrigger>
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
            <div className="mt-4">
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
            </div>
          </Tabs>
          {isLoading && (
            <div className="text-foreground flex-1 flex items-center justify-center">
              <Loading />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Notifications;
