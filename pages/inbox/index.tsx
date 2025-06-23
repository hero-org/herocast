import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { SelectableListWithHotkeys } from '../../src/common/components/SelectableListWithHotkeys';
import isEmpty from 'lodash.isempty';
import { useHotkeys } from 'react-hotkeys-hook';
import { Notification, NotificationTypeEnum, CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useDataStore } from '@/stores/useDataStore';
import { Loading } from '@/common/components/Loading';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CastRow } from '@/common/components/CastRow';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'next/router';
import SkeletonCastRow from '@/common/components/SkeletonCastRow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { formatLargeNumber } from '@/common/helpers/text';
import { useDraftStore } from '@/stores/useDraftStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, RefreshCw, Cloud } from 'lucide-react';

// Client-side cache for parent casts (prevents repeated API calls)
const parentCastCache = new Map<string, { cast: CastWithInteractions; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

enum NotificationTab {
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
    default:
      return undefined;
  }
};

// Map notification tab to API type string
const notificationTabToApiType = (tab: NotificationTab): string | undefined => {
  switch (tab) {
    case NotificationTab.mentions:
      return 'mentions';
    case NotificationTab.likes:
      return 'likes';
    case NotificationTab.follows:
      return 'follows';
    case NotificationTab.replies:
      return 'replies';
    case NotificationTab.recasts:
      return 'recasts';
    default:
      return undefined;
  }
};

// Compact follower profile component for follow notifications
const CompactFollowerProfile = ({ user, viewerFid }: { user: any; viewerFid: string }) => {
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

const Inbox = () => {
  const router = useRouter();
  const { isNewCastModalOpen, setCastModalView, openNewCastModal, setCastModalDraftId } = useNavigationStore();
  const { addNewPostDraft } = useDraftStore();
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const { isRead, markAsRead, markAsUnread, getUnreadCount } = useNotificationStore();
  const [notificationsByType, setNotificationsByType] = useState<Record<NotificationTab, Notification[]>>({
    [NotificationTab.replies]: [],
    [NotificationTab.mentions]: [],
    [NotificationTab.likes]: [],
    [NotificationTab.recasts]: [],
    [NotificationTab.follows]: [],
  });
  const cursorsByType = useRef<Record<NotificationTab, string | undefined>>({
    [NotificationTab.replies]: undefined,
    [NotificationTab.mentions]: undefined,
    [NotificationTab.likes]: undefined,
    [NotificationTab.recasts]: undefined,
    [NotificationTab.follows]: undefined,
  });
  const [loadingByType, setLoadingByType] = useState<Record<NotificationTab, boolean>>({
    [NotificationTab.replies]: false,
    [NotificationTab.mentions]: false,
    [NotificationTab.likes]: false,
    [NotificationTab.recasts]: false,
    [NotificationTab.follows]: false,
  });
  const [selectedNotificationIdx, setSelectedNotificationIdx] = useState<number>(0);
  const { updateSelectedCast } = useDataStore();
  const [activeTab, setActiveTab] = useState<NotificationTab>(NotificationTab.replies);
  const [parentCast, setParentCast] = useState<CastWithInteractions | null>(null);
  const [isLoadingParent, setIsLoadingParent] = useState<boolean>(false);
  const [lastAutoLoadTime, setLastAutoLoadTime] = useState<number>(0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  // Get current notifications for active tab
  const notifications = notificationsByType[activeTab];
  
  // Generate unique ID for notification
  const getNotificationId = (notification: Notification): string => {
    if (notification.type === NotificationTypeEnum.Follows && notification.follows) {
      // For follows, use the first follower's fid + timestamp
      return `follow-${notification.follows[0]?.user?.fid}-${notification.most_recent_timestamp}`;
    }
    // For other types, use cast hash + type + timestamp
    return `${notification.cast?.hash || 'unknown'}-${notification.type}-${notification.most_recent_timestamp}`;
  };

  const isLoading = loadingByType[activeTab] || false;
  const loadMoreCursor = cursorsByType.current[activeTab];

  const fetchNotifications = useCallback(
    async (tab: NotificationTab, reset = false, priorityMode = true, limit = 25) => {
      if (!viewerFid) return;

      // Set loading state for this specific tab
      setLoadingByType((prev) => ({ ...prev, [tab]: true }));

      try {
        const params = new URLSearchParams({
          fid: viewerFid,
          priorityMode: priorityMode.toString(),
          limit: limit.toString(),
        });

        // Add type parameter if not "all" tab
        const apiType = notificationTabToApiType(tab);
        if (apiType) {
          params.append('type', apiType);
        }

        // Add cursor for pagination if not reset
        if (!reset && cursorsByType.current[tab]) {
          params.append('cursor', cursorsByType.current[tab]!);
        }

        const response = await fetch(`/api/notifications?${params}`);
        const data = await response.json();

        if (data.notifications) {
          // Update notifications for this specific tab
          setNotificationsByType((prev) => ({
            ...prev,
            [tab]: reset ? data.notifications : [...prev[tab], ...data.notifications],
          }));

          // Update cursor for this tab
          cursorsByType.current[tab] = data.cursor;
        }

        return data.notifications || [];
      } catch (error) {
        console.error(`Error fetching notifications for ${tab}:`, error);
        return [];
      } finally {
        setLoadingByType((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [viewerFid]
  );

  const changeTab = useCallback(
    async (tab: NotificationTab) => {
      setActiveTab(tab);
      setSelectedNotificationIdx(0);
      setParentCast(null);

      // If this tab has no notifications loaded yet, fetch them
      if (notificationsByType[tab].length === 0 && !loadingByType[tab]) {
        await fetchNotifications(tab, true, true, 25);
      }
    },
    [notificationsByType, loadingByType, fetchNotifications]
  );

  const fetchParentCast = useCallback(
    async (parentHash: string) => {
      if (!viewerFid || !parentHash) return;

      // Check client-side cache first
      const cacheKey = `${parentHash}:${viewerFid}`;
      const cached = parentCastCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Client cache hit for parent cast: ${parentHash.substring(0, 10)}...`);
        setParentCast(cached.cast);
        return;
      }

      // Remove expired cache entry
      if (cached) {
        parentCastCache.delete(cacheKey);
      }

      setIsLoadingParent(true);
      try {
        const params = new URLSearchParams({
          casts: parentHash,
          viewerFid: viewerFid,
        });

        console.log(`Fetching parent cast: ${parentHash.substring(0, 10)}...`);
        const response = await fetch(`/api/casts?${params}`);
        const data = await response.json();

        if (data.result?.casts?.length > 0) {
          const cast = data.result.casts[0];
          setParentCast(cast);

          // Cache the result
          parentCastCache.set(cacheKey, { cast, timestamp: Date.now() });

          // Clean up cache periodically
          if (parentCastCache.size > 100) {
            const now = Date.now();
            for (const [k, v] of parentCastCache.entries()) {
              if (now - v.timestamp > CACHE_TTL) {
                parentCastCache.delete(k);
              }
            }
          }
        } else {
          setParentCast(null);
        }
      } catch (error) {
        console.error('Error fetching parent cast:', error);
        setParentCast(null);
      } finally {
        setIsLoadingParent(false);
      }
    },
    [viewerFid]
  );

  // Initial load and account changes
  useEffect(() => {
    if (!viewerFid) return;

    // Reset state immediately
    setSelectedNotificationIdx(0);
    setParentCast(null);
    setNotificationsByType({
      [NotificationTab.replies]: [],
      [NotificationTab.mentions]: [],
      [NotificationTab.likes]: [],
      [NotificationTab.recasts]: [],
      [NotificationTab.follows]: [],
    });
    cursorsByType.current = {
      [NotificationTab.replies]: undefined,
      [NotificationTab.mentions]: undefined,
      [NotificationTab.likes]: undefined,
      [NotificationTab.recasts]: undefined,
      [NotificationTab.follows]: undefined,
    };

    // Load notifications for the active tab
    console.log(`🚀 Loading notifications for ${activeTab} tab...`);
    fetchNotifications(activeTab, true, true, 25);
  }, [viewerFid, activeTab, fetchNotifications]);

  // Auto-refresh every 2 minutes for active tab
  useEffect(() => {
    if (!viewerFid) return;

    const intervalId = setInterval(
      () => {
        fetchNotifications(activeTab, true, true, 20); // Refresh active tab
      },
      2 * 60 * 1000
    );

    return () => clearInterval(intervalId);
  }, [viewerFid, activeTab, fetchNotifications]);

  // Update selected cast and fetch parent when notification selection changes
  useEffect(() => {
    // If notifications are empty (after refresh or on initial load), clear the selected cast
    if (isEmpty(notifications)) {
      updateSelectedCast(undefined);
      setParentCast(null);
      return;
    }

    // Don't process selection changes while loading to prevent jittery effect
    if (loadingByType[activeTab] || selectedNotificationIdx < 0) {
      return;
    }

    const notification = notifications[selectedNotificationIdx];
    if (!notification) return;
    
    // Mark as read immediately when selected
    const notificationId = getNotificationId(notification);
    if (!isRead(notificationId)) {
      markAsRead(notificationId, activeTab);
    }

    // Only update selected cast if the notification has a cast (not for follows)
    if (notification?.cast) {
      updateSelectedCast(notification.cast);

      // For replies and mentions, fetch the parent cast (only if we don't have it already)
      if (
        (notification.type === NotificationTypeEnum.Reply || notification.type === NotificationTypeEnum.Mention) &&
        notification.cast.parent_hash
      ) {
        // Check if we already have this parent cast to prevent repeated requests
        const currentParentHash = notification.cast.parent_hash;
        if (parentCast?.hash !== currentParentHash) {
          // Add a small delay to prevent rapid-fire requests during navigation
          const timeoutId = setTimeout(() => {
            fetchParentCast(currentParentHash);
          }, 150); // Increased delay to reduce jitter

          return () => clearTimeout(timeoutId);
        }
      } else {
        setParentCast(null);
      }
    } else {
      // Clear selected cast for follow notifications
      updateSelectedCast(undefined);
      setParentCast(null);
    }
  }, [notifications, selectedNotificationIdx, parentCast?.hash, loadingByType, activeTab, isRead, markAsRead, getNotificationId, updateSelectedCast]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedNotificationIdx(0);
  }, [activeTab]);

  // Scroll to top when tab changes
  useEffect(() => {
    if (listContainerRef.current) {
      // Find the scrollable container created by SelectableListWithHotkeys
      const scrollableElement = listContainerRef.current.querySelector('.overflow-y-auto');
      if (scrollableElement) {
        scrollableElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  // Cleanup effect to ensure hotkeys are properly removed on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts and reset state
      setParentCast(null);
      setIsLoadingParent(false);
      updateSelectedCast(undefined);
    };
  }, []);

  // Stable callback functions for hotkeys to prevent them from breaking
  const onReply = useCallback(() => {
    console.log('🔥 Reply hotkey pressed!', {
      selectedNotificationIdx,
      notificationsLength: notifications.length,
      isNewCastModalOpen,
    });

    if (selectedNotificationIdx >= 0 && notifications.length > selectedNotificationIdx) {
      const notification = notifications[selectedNotificationIdx];
      console.log('📬 Selected notification:', notification);

      if (notification?.cast) {
        console.log('📝 Creating reply draft for cast:', notification.cast.hash);
        setCastModalView(CastModalView.Reply);
        updateSelectedCast(notification.cast);
        addNewPostDraft({
          parentCastId: {
            hash: notification.cast.hash as any,
            fid: notification.cast.author.fid as any,
          },
          onSuccess(draftId) {
            console.log('✅ Draft created successfully:', draftId);
            setCastModalDraftId(draftId);
            openNewCastModal();
          },
        });
      } else {
        console.log('❌ No cast found in notification');
      }
    } else {
      console.log('❌ Invalid notification index or empty notifications');
    }
  }, [
    selectedNotificationIdx,
    notifications,
    setCastModalView,
    updateSelectedCast,
    addNewPostDraft,
    setCastModalDraftId,
    openNewCastModal,
    isNewCastModalOpen,
  ]);

  const onQuote = useCallback(() => {
    console.log('🔥 Quote hotkey pressed!', {
      selectedNotificationIdx,
      notificationsLength: notifications.length,
      isNewCastModalOpen,
    });

    if (selectedNotificationIdx >= 0 && notifications.length > selectedNotificationIdx) {
      const notification = notifications[selectedNotificationIdx];
      console.log('📬 Selected notification:', notification);

      if (notification?.cast) {
        console.log('💬 Creating quote draft for cast:', notification.cast.hash);
        setCastModalView(CastModalView.Quote);
        updateSelectedCast(notification.cast);
        addNewPostDraft({
          embeds: [
            {
              castId: {
                hash: notification.cast.hash as any,
                fid: notification.cast.author.fid as any,
              },
            },
          ],
          onSuccess(draftId) {
            console.log('✅ Quote draft created successfully:', draftId);
            setCastModalDraftId(draftId);
            openNewCastModal();
          },
        });
      } else {
        console.log('❌ No cast found in notification');
      }
    } else {
      console.log('❌ Invalid notification index or empty notifications');
    }
  }, [
    selectedNotificationIdx,
    notifications,
    setCastModalView,
    updateSelectedCast,
    addNewPostDraft,
    setCastModalDraftId,
    openNewCastModal,
    isNewCastModalOpen,
  ]);

  const onSelect = useCallback(() => {
    if (selectedNotificationIdx >= 0 && notifications.length > selectedNotificationIdx) {
      const notification = notifications[selectedNotificationIdx];
      if (notification) {
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
      }
    }
  }, [selectedNotificationIdx, notifications, router]);

  // Stable tab switching callbacks to prevent hotkey breaking
  const switchToReplies = useCallback(() => changeTab(NotificationTab.replies), [changeTab]);
  const switchToMentions = useCallback(() => changeTab(NotificationTab.mentions), [changeTab]);
  const switchToLikes = useCallback(() => changeTab(NotificationTab.likes), [changeTab]);
  const switchToRecasts = useCallback(() => changeTab(NotificationTab.recasts), [changeTab]);
  const switchToFollows = useCallback(() => changeTab(NotificationTab.follows), [changeTab]);
  const refreshNotifications = useCallback(
    async () => {
      // Clear all state before refresh
      setParentCast(null);
      updateSelectedCast(undefined);
      setSelectedNotificationIdx(0);
      
      // Clear notifications for current tab to show loading state
      setNotificationsByType((prev) => ({
        ...prev,
        [activeTab]: []
      }));
      
      // Fetch fresh notifications
      await fetchNotifications(activeTab, true, true, 25);
    },
    [fetchNotifications, activeTab, updateSelectedCast]
  );
  const loadMoreNotifications = useCallback(() => {
    if (cursorsByType.current[activeTab] && !loadingByType[activeTab]) {
      fetchNotifications(activeTab, false, true, 25);
    }
  }, [activeTab, loadingByType, fetchNotifications]);

  // Auto-load when scrolling near bottom with safeguards
  const handleScroll = useCallback(
    (event: Event) => {
      const container = event.target as HTMLElement;
      if (!container || !cursorsByType.current[activeTab] || loadingByType[activeTab]) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Trigger when 85% scrolled (earlier trigger) and prevent rapid requests
      const now = Date.now();
      const timeSinceLastLoad = now - lastAutoLoadTime;

      if (scrollPercentage > 0.85 && timeSinceLastLoad > 1500) {
        // 1.5 second throttle, 85% trigger
        console.log(`🔄 Auto-loading more notifications (${(scrollPercentage * 100).toFixed(1)}% scrolled)`);
        setLastAutoLoadTime(now);
        fetchNotifications(activeTab, false, true, 25);
      }
    },
    [activeTab, loadingByType, lastAutoLoadTime, fetchNotifications]
  );

  // Attach scroll listener to the actual scrollable element inside SelectableListWithHotkeys
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    // Find the scrollable element (it's usually the first child with overflow-y-auto)
    const scrollableElement = container.querySelector('[style*="overflow-y: auto"], .overflow-y-auto');
    if (!scrollableElement) {
      console.warn('Could not find scrollable element for auto-load');
      return;
    }

    console.log('📜 Attached scroll listener to:', scrollableElement.className);
    scrollableElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollableElement.removeEventListener('scroll', handleScroll);
  }, [handleScroll, notifications.length]); // Re-attach when notifications change

  // Smart auto-load for sparse tabs (handles edge case of few notifications)
  useEffect(() => {
    // If we have very few notifications (1-3) but there's more data available, auto-load
    const shouldAutoLoad =
      notifications.length > 0 &&
      notifications.length <= 3 &&
      cursorsByType.current[activeTab] &&
      !loadingByType[activeTab];

    if (shouldAutoLoad) {
      const now = Date.now();
      const timeSinceLastLoad = now - lastAutoLoadTime;

      // Only auto-load if we haven't done it recently (prevent infinite loops)
      if (timeSinceLastLoad > 5000) {
        // 5 second throttle for sparse auto-loading
        console.log(
          `📈 Sparse tab auto-load: ${activeTab} has only ${notifications.length} notifications, loading more...`
        );
        setLastAutoLoadTime(now);
        fetchNotifications(activeTab, false, true, 25);
      }
    }
  }, [notifications, activeTab, loadingByType, lastAutoLoadTime, fetchNotifications]);

  // Tab cycling functions
  const tabOrder = [
    NotificationTab.replies,
    NotificationTab.mentions,
    NotificationTab.likes,
    NotificationTab.recasts,
    NotificationTab.follows,
  ];

  const cycleToNextTab = useCallback(() => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % tabOrder.length;
    changeTab(tabOrder[nextIndex]);
    console.log(`🔄 Tab navigation: ${activeTab} → ${tabOrder[nextIndex]}`);
  }, [activeTab, changeTab]);

  const cycleToPrevTab = useCallback(() => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const prevIndex = currentIndex === 0 ? tabOrder.length - 1 : currentIndex - 1;
    changeTab(tabOrder[prevIndex]);
    console.log(`🔄 Shift+Tab navigation: ${activeTab} → ${tabOrder[prevIndex]}`);
  }, [activeTab, changeTab]);

  // Mark selected notification as read
  const markSelectedAsRead = useCallback(() => {
    if (selectedNotificationIdx >= 0 && notifications.length > selectedNotificationIdx) {
      const notification = notifications[selectedNotificationIdx];
      const notificationId = getNotificationId(notification);
      
      // Always mark as read, even if already read
      markAsRead(notificationId, activeTab);
    }
  }, [selectedNotificationIdx, notifications, markAsRead, getNotificationId, activeTab]);

  // Keyboard shortcuts with proper dependency arrays and stable callbacks
  useHotkeys(
    'r',
    onReply,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      preventDefault: true,
      enableOnContentEditable: false,
    },
    [onReply]
  );

  // Note: Removed debug logging to reduce console noise and potential jitter

  useHotkeys(
    'q',
    onQuote,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      preventDefault: true,
      enableOnContentEditable: false,
    },
    [onQuote]
  );

  useHotkeys(
    ['o', 'enter'],
    onSelect,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      preventDefault: true,
      enableOnContentEditable: false,
    },
    [onSelect]
  );

  // Tab switching shortcuts with stable callbacks
  useHotkeys(
    '1',
    switchToReplies,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToReplies]
  );

  useHotkeys(
    '2',
    switchToMentions,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToMentions]
  );

  useHotkeys(
    '3',
    switchToLikes,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToLikes]
  );

  useHotkeys(
    '4',
    switchToRecasts,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToRecasts]
  );

  useHotkeys(
    '5',
    switchToFollows,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToFollows]
  );

  // Refresh shortcut
  useHotkeys(
    'shift+r',
    refreshNotifications,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [refreshNotifications]
  );

  // Load more shortcut for power users
  useHotkeys(
    'shift+l',
    loadMoreNotifications,
    {
      enabled: !isNewCastModalOpen && !!cursorsByType.current[activeTab],
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [loadMoreNotifications, activeTab]
  );

  // Tab cycling shortcuts
  useHotkeys(
    'tab',
    cycleToNextTab,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
    [cycleToNextTab]
  );

  useHotkeys(
    'shift+tab',
    cycleToPrevTab,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
    [cycleToPrevTab]
  );
  
  // Mark as read
  useHotkeys(
    'e',
    markSelectedAsRead,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
    [markSelectedAsRead]
  );

  const getActionDescriptionForRow = (notification: Notification): string => {
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

  const renderNotificationRow = (notification: Notification, idx: number) => {
    const { cast } = notification;
    const timeAgoStr = formatDistanceToNowStrict(new Date(notification.most_recent_timestamp));
    const actionDescription = getActionDescriptionForRow(notification);
    const notificationId = getNotificationId(notification);
    const isNotificationRead = isRead(notificationId);

    // Handle follow notifications specially
    if (notification.type === NotificationTypeEnum.Follows && notification.follows) {
      const firstFollower = notification.follows[0]?.user;
      const remainingCount = notification.follows.length - 1;

      return (
        <li
          key={`notification-${notification.most_recent_timestamp}`}
          className={cn(
            'flex gap-x-4 px-4 py-3 border-b border-muted/50 transition-colors border-l-2',
            idx === selectedNotificationIdx
              ? 'bg-muted border-l-blue-500'
              : 'cursor-pointer bg-background/80 hover:bg-muted/50 border-l-transparent'
          )}
          onClick={() => setSelectedNotificationIdx(idx)}
        >
          <div className="relative mt-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={firstFollower?.pfp_url} />
              <AvatarFallback>{firstFollower?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {/* Unread indicator */}
            {!isNotificationRead && (
              <div className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 bg-blue-500 rounded-full" />
            )}
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

    // Regular notification handling
    const author = cast?.author || selectedAccount.user;

    return (
      <li
        key={`notification-${notification.most_recent_timestamp}`}
        className={cn(
          'flex gap-x-4 px-4 py-3 border-b border-muted/50 transition-colors border-l-2',
          idx === selectedNotificationIdx
            ? 'bg-muted border-l-blue-500'
            : 'cursor-pointer bg-background/80 hover:bg-muted/50 border-l-transparent'
        )}
        onClick={() => setSelectedNotificationIdx(idx)}
      >
        <div className="relative mt-1">
          <Avatar className="h-8 w-8 flex-none">
            <AvatarImage src={author?.pfp_url} />
            <AvatarFallback>{author?.username?.slice(0, 2)}</AvatarFallback>
          </Avatar>
          {/* Unread indicator */}
          {!isNotificationRead && (
            <div className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 bg-blue-500 rounded-full" />
          )}
        </div>
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
  };

  const renderSelectedNotificationDetail = () => {
    const notification = notifications[selectedNotificationIdx];
    if (!notification) return null;

    const isReplyOrMention =
      notification.type === NotificationTypeEnum.Reply || notification.type === NotificationTypeEnum.Mention;

    const isFollow = notification.type === NotificationTypeEnum.Follows;

    // Handle follow notifications
    if (isFollow && notification.follows) {
      return (
        <div className="flex-1 border-l border-muted flex flex-col">
          <div className="px-4 py-3 border-b border-muted/50 bg-muted/30">
            <h3 className="text-sm font-medium text-foreground">
              {notification.follows.length} New Follower{notification.follows.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {notification.follows?.map((follow) => (
                <CompactFollowerProfile key={follow.user.fid} user={follow.user} viewerFid={viewerFid || ''} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Handle other notification types that don't have casts
    if (!notification.cast) return null;

    return (
      <div className="flex-1 border-l border-muted flex flex-col">
        {/* Show parent cast for replies and mentions */}
        {isReplyOrMention && (
          <div className="border-b border-muted/50">
            {isLoadingParent ? (
              <div className="p-4">
                <SkeletonCastRow />
              </div>
            ) : parentCast ? (
              <>
                <div className="px-4 py-2 text-sm text-foreground/60 bg-muted/30">Replying to:</div>
                <CastRow
                  cast={parentCast}
                  showChannel
                  onCastClick={() => router.push(`/conversation/${parentCast.hash}`)}
                />
              </>
            ) : notification.cast.parent_hash ? (
              <div className="px-4 py-3 text-sm text-foreground/60">Parent cast not found</div>
            ) : null}
          </div>
        )}

        {/* The reply/mention/like/recast cast */}
        <CastRow
          cast={notification.cast}
          showChannel
          isSelected={true}
          onCastClick={() => router.push(`/conversation/${notification.cast?.hash}`)}
        />
      </div>
    );
  };

  if (!viewerFid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-foreground/60">Please connect an account to view notifications.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-muted px-4 py-3">
        {/* Tabs with Refresh Button */}
        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as NotificationTab)}>
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-5 flex-1 mr-3">
              <TabsTrigger value={NotificationTab.replies} className="text-xs relative">
                Replies
                {activeTab === NotificationTab.replies && (() => {
                  const notificationIds = notificationsByType[NotificationTab.replies].map(getNotificationId);
                  const unreadCount = getUnreadCount(NotificationTab.replies, notificationIds);
                  return unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value={NotificationTab.mentions} className="text-xs relative">
                Mentions
                {activeTab === NotificationTab.mentions && (() => {
                  const notificationIds = notificationsByType[NotificationTab.mentions].map(getNotificationId);
                  const unreadCount = getUnreadCount(NotificationTab.mentions, notificationIds);
                  return unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value={NotificationTab.likes} className="text-xs relative">
                Likes
                {activeTab === NotificationTab.likes && (() => {
                  const notificationIds = notificationsByType[NotificationTab.likes].map(getNotificationId);
                  const unreadCount = getUnreadCount(NotificationTab.likes, notificationIds);
                  return unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value={NotificationTab.recasts} className="text-xs relative">
                Recasts
                {activeTab === NotificationTab.recasts && (() => {
                  const notificationIds = notificationsByType[NotificationTab.recasts].map(getNotificationId);
                  const unreadCount = getUnreadCount(NotificationTab.recasts, notificationIds);
                  return unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value={NotificationTab.follows} className="text-xs relative">
                Follows
                {activeTab === NotificationTab.follows && (() => {
                  const notificationIds = notificationsByType[NotificationTab.follows].map(getNotificationId);
                  const unreadCount = getUnreadCount(NotificationTab.follows, notificationIds);
                  return unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const notificationIds = notifications.map(getNotificationId);
                  useNotificationStore.getState().markAllAsRead(activeTab, notificationIds);
                }}
                disabled={loadingByType[activeTab]}
                className="flex-shrink-0"
              >
                Mark all read
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-shrink-0 px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={refreshNotifications}
                    disabled={loadingByType[activeTab]}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      console.log('Manual sync triggered');
                      useNotificationStore.getState().syncToSupabase();
                    }}
                  >
                    <Cloud className="mr-2 h-4 w-4" />
                    Sync to cloud
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Notifications list */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-hidden" ref={listContainerRef}>
            {isEmpty(notifications) && !loadingByType[activeTab] ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-foreground/60">No notifications found.</p>
              </div>
            ) : (
              <SelectableListWithHotkeys
                data={notifications}
                selectedIdx={selectedNotificationIdx}
                setSelectedIdx={(idx) => {
                  // Don't update selection while loading to prevent jitter
                  if (!loadingByType[activeTab]) {
                    setSelectedNotificationIdx(idx);
                  }
                }}
                renderRow={renderNotificationRow}
                onSelect={onSelect}
                isActive={!isNewCastModalOpen && !loadingByType[activeTab]}
                pinnedNavigation={true}
                containerHeight="100%"
              />
            )}
          </div>

          <div className="border-t border-muted p-3 bg-background/95">
            {loadingByType[activeTab] && notifications.length > 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-2">
                <Loading />
                <span className="text-sm text-foreground/70">Loading more notifications...</span>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={loadMoreNotifications}
                  disabled={!cursorsByType.current[activeTab] || loadingByType[activeTab]}
                  className="w-full mb-2"
                >
                  Load More
                </Button>
                <p className="text-xs text-foreground/50 text-center">{notifications.length} notifications shown</p>
              </>
            )}
          </div>
        </div>

        {/* Selected notification detail */}
        {renderSelectedNotificationDetail()}
      </div>
    </div>
  );
};

export default Inbox;
