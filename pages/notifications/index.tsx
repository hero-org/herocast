import React, { useEffect, useState, useRef } from 'react';

import { castTextStyle } from '@/common/helpers/css';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { SelectableListWithHotkeys } from '../../src/common/components/SelectableListWithHotkeys';
import isEmpty from 'lodash.isempty';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import {
  CastWithInteractions,
  Notification,
  NotificationTypeEnum,
  ReactionWithUserInfo,
} from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useDataStore } from '@/stores/useDataStore';
import { Loading } from '@/common/components/Loading';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import orderBy from 'lodash.orderby';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/common/helpers/hooks';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CastRow } from '@/common/components/CastRow';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import ProfileInfo from '@/common/components/ProfileInfo';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';

const DEFAULT_SHOW_REACTIONS_LIMIT = 15;

enum NotificationTab {
  all = 'all',
  mentions = 'mentions',
  replies = 'replies',
  likes = 'likes',
  recasts = 'recasts',
  follows = 'follows',
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

const filterNotificationsByActiveTab = (notifications: Notification[], selectedTab: NotificationTab) => {
  const notificationType = notificationTabToType(selectedTab);
  if (!notificationType) return notifications;

  return notifications.filter((notification) => notification.type === notificationType);
};

const renderTabsTrigger = (value: NotificationTab, label: string) => (
  <TabsTrigger className="w-full" value={value}>
    {label}
  </TabsTrigger>
);

const Notifications = () => {
  const { isNewCastModalOpen, setCastModalView, openNewCastModal, closeNewCastModal } = useNavigationStore();

  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const isMobile = useIsMobile();
  const [allNotifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedNotificationIdx, setSelectedNotificationIdx] = useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] = useState<boolean>(true);
  const [parentCastHash, setParentCastHash] = useState<string>();
  const [parentCast, setParentCast] = useState<CastWithInteractions>();
  const { selectedCast, updateSelectedCast } = useDataStore();
  const [loadMoreCursor, setLoadMoreCursor] = useState<string>();
  const [activeTab, setActiveTab] = useState<NotificationTab>(NotificationTab.replies);
  const [showReactionsLimit, setShowReactionsLimit] = useState<number>(DEFAULT_SHOW_REACTIONS_LIMIT);
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);
  const notifications = filterNotificationsByActiveTab(allNotifications, activeTab);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  const changeTab = (tab: NotificationTab) => {
    setActiveTab(tab);
    setSelectedNotificationIdx(0);
    setParentCastHash(undefined);
    setParentCast(undefined);
  };

  useEffect(() => {
    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
    };
  }, []);

  const fetchNotifications = async ({ reset }: { reset?: boolean }) => {
    if (!viewerFid) return;
    console.log('Notifications Page -> fetchNotifications. reset', reset);
    setIsLoading(true);
    if (reset) {
      setNotifications([]);
    }
    const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

    const options = reset
      ? {}
      : {
          cursor: loadMoreCursor,
        };
    const resp = await neynarClient.fetchAllNotifications(Number(viewerFid), options);
    if (resp.notifications) {
      if (reset) {
        setNotifications(resp.notifications);
      } else {
        setNotifications([...allNotifications, ...resp.notifications]);
      }
      setLoadMoreCursor(resp.next.cursor);
    }
    setIsLoading(false);
    lastUpdateTimeRef.current = Date.now();
  };

  useEffect(() => {
    if (!viewerFid) return;

    setLoadMoreCursor(undefined);
    fetchNotifications({ reset: true });

    closeNewCastModal();
    setIsLeftColumnSelected(true);
    setSelectedNotificationIdx(0);
  }, [viewerFid]);

  useEffect(() => {
    const checkAndUpdateNotifications = () => {
      const currentTime = Date.now();
      if (currentTime - lastUpdateTimeRef.current > 5 * 60 * 1000) {
        // 5 minutes
        fetchNotifications({ reset: true });
        lastUpdateTimeRef.current = currentTime;
      }
    };

    const intervalId = setInterval(checkAndUpdateNotifications, 60 * 1000); // Check every minute

    return () => clearInterval(intervalId);
  }, [viewerFid]);

  useEffect(() => {
    setSelectedNotificationIdx(0);
  }, [activeTab]);

  useEffect(() => {
    if (parentCastHash) {
      const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
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

  useHotkeys('r', onReply, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys('q', onQuote, [openNewCastModal], {
    enabled: !isNewCastModalOpen,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys(
    ['tab', 'shift+tab'],
    () => {
      setIsLeftColumnSelected(!isLeftColumnSelected);
    },
    [isLeftColumnSelected],
    {
      enabled: !isNewCastModalOpen,
      preventDefault: true,
    }
  );

  useHotkeys('shift+1', () => changeTab(NotificationTab.all), [], {});
  useHotkeys('shift+2', () => changeTab(NotificationTab.replies), [], {});
  useHotkeys('shift+3', () => changeTab(NotificationTab.mentions), [], {});
  useHotkeys('shift+4', () => changeTab(NotificationTab.likes), [], {});
  useHotkeys('shift+5', () => changeTab(NotificationTab.recasts), [], {});
  useHotkeys('shift+6', () => changeTab(NotificationTab.follows), [], {});

  useHotkeys(
    ['l', 'o', Key.Enter, Key.ArrowRight],
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
    ['h', Key.Escape, Key.ArrowLeft],
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
    const cast = notification.cast;
    switch (notification.type) {
      case NotificationTypeEnum.Reply:
        return cast ? `@${cast.author.username} replied` : 'Someone replied';
      case NotificationTypeEnum.Mention:
        return cast ? `@${cast.author.username} mentioned you` : 'Someone mentioned you';
      case NotificationTypeEnum.Likes:
        return `Received ${notification.reactions?.length} likes`;
      case NotificationTypeEnum.Follows:
        return `${notification.follows?.length} new followers`;
      case NotificationTypeEnum.Recasts:
        return `Received ${notification.reactions?.length} recasts`;
      default:
        return '';
    }
  };

  const renderNotificationRow = (notification: Notification, idx: number) => {
    const { cast } = notification;

    const timeAgoStr = formatDistanceToNowStrict(new Date(notification.most_recent_timestamp));
    const actionDescription = getActionDescriptionForRow(notification);
    const author = notification.type !== NotificationTypeEnum.Follows ? cast?.author : selectedAccount.user;

    return (
      <li
        key={`item-${notification.most_recent_timestamp}`}
        onClick={() => {
          setSelectedNotificationIdx(idx);
          scrollTo(0, 0);
          if (isMobile) {
            setIsLeftColumnSelected(false);
          }
        }}
        className={cn(
          idx === selectedNotificationIdx ? 'bg-muted' : 'cursor-pointer bg-background/80 hover:bg-muted/10',
          'flex gap-x-4 px-5 py-4 border-b border-muted'
        )}
      >
        <img className="mt-1.5 rounded-full h-10 w-10 flex-none bg-background" src={author?.pfp_url} alt="" />
        <div className="flex-auto">
          <div className="flex items-center justify-between gap-x-4">
            <p className="text-sm leading-6 text-foreground">{actionDescription}</p>
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

  const renderLoadNotificationsButton = () => (
    <div className="flex justify-center my-8">
      <Button variant="outline" size="lg" disabled={isLoading} onClick={() => fetchNotifications({ reset: false })}>
        {isLoading ? <Loading /> : `Load ${notifications.length === 0 ? '' : 'more'}`}
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
      <div
        className={cn(
          'overflow-hidden rounded-l-lg border',
          isLeftColumnSelected ? 'border-muted-foreground/20' : 'border-muted-foreground'
        )}
      >
        <div key={`left-column-${activeTab}`} className="divide-y divide-white/5">
          <SelectableListWithHotkeys
            data={notifications}
            selectedIdx={selectedNotificationIdx}
            setSelectedIdx={setSelectedNotificationIdx}
            renderRow={(item: Notification, idx: number) => renderNotificationRow(item, idx)}
            isActive={isLeftColumnSelected && !isNewCastModalOpen}
            disableScroll
          />
          <div>{renderLoadNotificationsButton()}</div>
        </div>
      </div>
    );
  };

  const renderProfilesFromReactions = (reactions?: ReactionWithUserInfo[]) => {
    if (!reactions) return null;

    const reactionFids = orderBy(reactions, ['user.follower_count'], ['desc'])
      .slice(0, showReactionsLimit)
      .map((reaction) => reaction.user.fid);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 items-center">
        {reactionFids &&
          reactionFids.map((fid) => (
            <div key={fid} className="flex self-start h-full gap-2 p-2">
              <ProfileInfo fid={fid} viewerFid={Number(viewerFid)} showFollowButton hideBio />
            </div>
          ))}
        {reactions.length > showReactionsLimit && renderShowMoreReactionsButton()}
      </div>
    );
  };

  const renderMainContent = () => {
    const notification = notifications[selectedNotificationIdx];
    if (isEmpty(notification) && !isLoading && isEmpty(notifications))
      return (
        <div className="text-foreground flex-1 flex items-center justify-center">{renderLoadNotificationsButton()}</div>
      );

    if (!notification) return null;
    const notificationType = notification.type;

    const renderContentHeader = () => {
      let title = '';
      switch (notificationType) {
        case NotificationTypeEnum.Likes:
          title = 'Liked by';
          break;
        case NotificationTypeEnum.Follows:
          title = 'Followed you';
          break;
        case NotificationTypeEnum.Recasts:
          title = 'Recasted by';
          break;
      }
      return (
        title && (
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>
        )
      );
    };

    return (
      <div
        className={cn(
          isLeftColumnSelected ? 'hidden md:block border-muted-foreground' : 'border-muted-foreground/20',
          'flex-1 rounded-lg border md:rounded-l-none lg:border-0'
        )}
      >
        {renderGoBack()}
        <div className="min-h-full h-full">
          {(notificationType === NotificationTypeEnum.Reply || notificationType === NotificationTypeEnum.Mention) && (
            <div className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full">
              {parentCast && <CastRow cast={parentCast} showChannel />}
              {!parentCast && parentCastHash && <SkeletonCastRow />}
            </div>
          )}
          <div className="border-b border-foreground/20 relative flex items-center space-x-4 max-w-full">
            {selectedCast && <CastRow cast={selectedCast} showChannel />}
          </div>
          {renderContentHeader()}
          {(notificationType === NotificationTypeEnum.Likes || notificationType === NotificationTypeEnum.Recasts) && (
            <div className="mx-4 max-w-full">{renderProfilesFromReactions(notification.reactions)}</div>
          )}
          {notificationType === NotificationTypeEnum.Follows && (
            <div className="mx-4 max-w-full">{renderProfilesFromReactions(notification.follows)}</div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!isEmpty(notifications) && selectedNotificationIdx > -1) {
      const notification = notifications[selectedNotificationIdx];

      if (!notification) return;

      if (notification.type === NotificationTypeEnum.Reply || notification.type === NotificationTypeEnum.Mention) {
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
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter</span>
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

  const renderGoBack = () => (
    <div className="border-b p-4 md:hidden">
      <Button variant="outline" onClick={() => setIsLeftColumnSelected(true)}>
        Go back
      </Button>
    </div>
  );

  return (
    <div className="flex md:min-h-screen min-w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <main className="grid flex-1 items-start gap-4 px-4 md:px-0">
          <Tabs
            defaultValue={NotificationTab.all}
            value={activeTab}
            onValueChange={(value: string) => changeTab(value as NotificationTab)}
          >
            <div className="w-full md:max-w-xl md:mx-4">
              <TabsList className="grid grid-cols-3 md:grid-cols-6">
                {renderTabsTrigger(NotificationTab.all, 'All')}
                {renderTabsTrigger(NotificationTab.replies, 'Replies')}
                {renderTabsTrigger(NotificationTab.mentions, 'Mentions')}
                {renderTabsTrigger(NotificationTab.likes, 'Likes')}
                {renderTabsTrigger(NotificationTab.recasts, 'Recasts')}
                {renderTabsTrigger(NotificationTab.follows, 'Follows')}
              </TabsList>
            </div>
            <div className="mt-4">
              <div className="mx-auto flex w-full max-w-7xl items-start px-0 md:px-4">
                <div
                  className={cn(isLeftColumnSelected ? 'block' : 'hidden md:block', 'w-full md:w-1/3 md:1/2 shrink-0')}
                >
                  {renderLeftColumn()}
                </div>
                {renderMainContent()}
              </div>
            </div>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Notifications;
