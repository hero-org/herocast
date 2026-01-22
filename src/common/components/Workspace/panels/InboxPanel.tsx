'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Notification, NotificationTypeEnum, CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { CastRow } from '@/common/components/CastRow';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import { InboxPanelConfig } from '@/common/types/workspace.types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import isEmpty from 'lodash.isempty';
import { useAccountStore } from '@/stores/useAccountStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';
import { formatLargeNumber } from '@/common/helpers/text';
import Link from 'next/link';

const PREFETCH_THRESHOLD = 3;
const DEFAULT_LIMIT = 25;

// Map panel tab config to API type
const tabToApiType = (tab: InboxPanelConfig['tab']): string => {
  switch (tab) {
    case 'mentions':
      return 'mentions';
    case 'likes':
      return 'likes';
    case 'follows':
      return 'follows';
    case 'replies':
      return 'replies';
    case 'recasts':
      return 'recasts';
    default:
      return 'replies';
  }
};

// Map panel tab to notification type enum for type checking
const tabToNotificationType = (tab: InboxPanelConfig['tab']): NotificationTypeEnum => {
  switch (tab) {
    case 'mentions':
      return NotificationTypeEnum.Mention;
    case 'likes':
      return NotificationTypeEnum.Likes;
    case 'follows':
      return NotificationTypeEnum.Follows;
    case 'replies':
      return NotificationTypeEnum.Reply;
    case 'recasts':
      return NotificationTypeEnum.Recasts;
    default:
      return NotificationTypeEnum.Reply;
  }
};

// Compact follower profile component for follow notifications
const CompactFollowerProfile = ({ user }: { user: any }) => {
  return (
    <Link href={`/profile/${user.username}`} prefetch={false}>
      <div className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg border border-muted/30 transition-colors">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={user.pfp_url} />
          <AvatarFallback>{user.username?.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground truncate">{user.display_name}</span>
            {user.power_badge && <img src="/images/ActiveBadge.webp" className="h-3.5 w-3.5" alt="Power badge" />}
          </div>
          <div className="text-xs text-foreground/60 truncate">@{user.username}</div>
          {user.profile?.bio?.text && (
            <p className="text-xs text-foreground/70 mt-1 line-clamp-2 break-words">{user.profile.bio.text}</p>
          )}
          <div className="flex gap-3 mt-1 text-xs text-foreground/60">
            <span>{formatLargeNumber(user.follower_count || 0)} followers</span>
            <span>{formatLargeNumber(user.following_count || 0)} following</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

interface InboxPanelProps {
  config: InboxPanelConfig;
  isCollapsed: boolean;
  panelId: string;
}

const InboxPanel: React.FC<InboxPanelProps> = ({ config, isCollapsed, panelId }) => {
  const router = useRouter();
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  // State for notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  // Refs
  const lastUpdateTimeRef = useRef(Date.now());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (reset = false) => {
      if (!viewerFid || isCollapsed) return;

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          fid: viewerFid,
          limit: DEFAULT_LIMIT.toString(),
          type: tabToApiType(config.tab),
        });

        if (!reset && cursor) {
          params.append('cursor', cursor);
        }

        const response = await fetch(`/api/notifications?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }

        const data = await response.json();

        if (data.notifications) {
          setNotifications((prev) => (reset ? data.notifications : [...prev, ...data.notifications]));
          setCursor(data.cursor);
          setHasMore(!!data.cursor);
        }

        lastUpdateTimeRef.current = Date.now();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error(`Error fetching notifications for ${config.tab}:`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [viewerFid, config.tab, cursor, isCollapsed]
  );

  // Initial load and tab changes
  useEffect(() => {
    if (!viewerFid || isCollapsed) return;

    // Reset state
    setNotifications([]);
    setCursor(undefined);
    setHasMore(true);

    // Fetch initial data
    fetchNotifications(true);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [viewerFid, config.tab, isCollapsed]);

  // Auto-load more when scrolling near end
  useEffect(() => {
    if (inView && hasMore && !isLoading && !isCollapsed && notifications.length > 0) {
      fetchNotifications(false);
    }
  }, [inView, hasMore, isLoading, isCollapsed, notifications.length]);

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // For follow notifications, navigate to the first follower's profile
      if (
        notification.type === NotificationTypeEnum.Follows &&
        notification.follows &&
        notification.follows.length > 0
      ) {
        const firstFollower = notification.follows[0]?.user;
        router.push(`/profile/${firstFollower.username}`);
      }
      // For other notifications with casts, navigate to the conversation
      else if (notification.cast) {
        router.push(`/conversation/${notification.cast.hash}`);
      }
    },
    [router]
  );

  // Get action description for notification
  const getActionDescription = (notification: Notification): string => {
    const cast = notification.cast;
    switch (notification.type) {
      case NotificationTypeEnum.Reply:
        return cast ? `@${cast.author.username} replied` : 'Someone replied';
      case NotificationTypeEnum.Mention:
        return cast ? `@${cast.author.username} mentioned you` : 'Someone mentioned you';
      case NotificationTypeEnum.Likes:
        return `${notification.reactions?.length || 1} like${(notification.reactions?.length || 1) > 1 ? 's' : ''}`;
      case NotificationTypeEnum.Follows:
        return `${notification.follows?.length || 1} new follower${(notification.follows?.length || 1) > 1 ? 's' : ''}`;
      case NotificationTypeEnum.Recasts:
        return `${notification.reactions?.length || 1} recast${(notification.reactions?.length || 1) > 1 ? 's' : ''}`;
      default:
        return '';
    }
  };

  // Render a notification row
  const renderNotificationRow = (notification: Notification, idx: number) => {
    const timeAgoStr = formatDistanceToNowStrict(new Date(notification.most_recent_timestamp));
    const actionDescription = getActionDescription(notification);
    const isSentinel = idx === notifications.length - PREFETCH_THRESHOLD;

    // Handle follow notifications specially
    if (notification.type === NotificationTypeEnum.Follows && notification.follows) {
      const firstFollower = notification.follows[0]?.user;
      const remainingCount = notification.follows.length - 1;

      return (
        <li
          key={`notification-${notification.most_recent_timestamp}-${idx}`}
          ref={isSentinel ? loadMoreRef : undefined}
          className="flex gap-x-4 px-4 py-3 border-b border-muted/50 transition-colors cursor-pointer hover:bg-muted/50"
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="relative mt-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={firstFollower?.pfp_url} />
              <AvatarFallback>{firstFollower?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {remainingCount > 0 && (
              <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                +{Math.min(remainingCount, 9)}
              </div>
            )}
          </div>
          <div className="flex-auto min-w-0">
            <div className="flex items-center justify-between gap-x-4">
              <p className="text-sm font-medium text-foreground truncate">{actionDescription}</p>
              <p className="flex-none text-xs text-foreground/60">
                <time dateTime={timeAgoStr}>{timeAgoStr}</time>
              </p>
            </div>
            <p className="mt-1 text-sm text-foreground/70 truncate">
              {firstFollower?.display_name || firstFollower?.username}
              {remainingCount > 0 && ` and ${remainingCount} other${remainingCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </li>
      );
    }

    // For likes/recasts, show a simpler row with the cast text
    if (notification.type === NotificationTypeEnum.Likes || notification.type === NotificationTypeEnum.Recasts) {
      const { cast } = notification;
      return (
        <li
          key={`notification-${notification.most_recent_timestamp}-${idx}`}
          ref={isSentinel ? loadMoreRef : undefined}
          className="flex gap-x-4 px-4 py-3 border-b border-muted/50 transition-colors cursor-pointer hover:bg-muted/50"
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex-auto min-w-0">
            <div className="flex items-center justify-between gap-x-4">
              <p className="text-sm font-medium text-foreground truncate">{actionDescription}</p>
              <p className="flex-none text-xs text-foreground/60">
                <time dateTime={timeAgoStr}>{timeAgoStr}</time>
              </p>
            </div>
            {cast?.text && <p className="mt-1 text-sm text-foreground/70 line-clamp-2 break-words">{cast.text}</p>}
          </div>
        </li>
      );
    }

    // For replies and mentions, render the cast using CastRow
    if (notification.cast) {
      return (
        <li
          key={`notification-${notification.most_recent_timestamp}-${idx}`}
          ref={isSentinel ? loadMoreRef : undefined}
          className="border-b border-foreground/20 relative w-full overflow-hidden"
        >
          <CastRow
            cast={notification.cast}
            showChannel={true}
            onSelect={() => handleNotificationClick(notification)}
            onCastClick={() => handleNotificationClick(notification)}
          />
        </li>
      );
    }

    return null;
  };

  // Render collapsed state
  if (isCollapsed) {
    return null;
  }

  // Render loading state
  if (isLoading && isEmpty(notifications)) {
    return (
      <div className="flex flex-col min-h-0 h-full w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {Array.from({ length: 5 }).map((_, idx) => (
            <SkeletonCastRow key={`skeleton-${panelId}-${idx}`} />
          ))}
        </div>
      </div>
    );
  }

  // Render empty state
  if (!isLoading && isEmpty(notifications)) {
    return (
      <div className="flex flex-col min-h-0 h-full items-center justify-center p-4 w-full">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base">No {config.tab} found</CardTitle>
            <CardDescription>
              {viewerFid
                ? 'No notifications yet. Check back later.'
                : 'Please connect an account to view notifications.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="divide-y divide-foreground/10">
          {notifications.map((notification, idx) => renderNotificationRow(notification, idx))}
        </ul>

        {/* Loading indicator for pagination */}
        {isLoading && notifications.length > 0 && (
          <div className="p-4">
            <SkeletonCastRow />
          </div>
        )}

        {/* End of feed indicator */}
        {!hasMore && notifications.length > 0 && (
          <div className="p-4 text-center text-sm text-foreground/50">No more {config.tab}</div>
        )}
      </div>
    </div>
  );
};

export default InboxPanel;
