import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { SelectableListWithHotkeys } from '../../src/common/components/SelectableListWithHotkeys';
import isEmpty from 'lodash.isempty';
import { useHotkeys } from 'react-hotkeys-hook';
import { Loading } from '@/common/components/Loading';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'next/router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, RefreshCw, MessageSquare, Users, Archive, CheckCheck, Settings } from 'lucide-react';
import { KeyboardShortcutTooltip } from '@/components/ui/keyboard-shortcut-tooltip';
import { AnimatedMessageThread } from '@/common/components/DirectMessages/AnimatedMessageThread';
import { Message } from '@/common/components/DirectMessages/MessageThread';
import { DMsOnboarding } from '@/common/components/DirectMessages/DMsOnboarding';
import { DMErrorBoundary } from '@/common/components/DirectMessages/DMErrorBoundary';
import { DMLoadingState } from '@/common/components/DirectMessages/DMLoadingState';
import { DMEmptyState } from '@/common/components/DirectMessages/DMEmptyState';
import { DMErrorState } from '@/common/components/DirectMessages/DMErrorState';
import { ConversationListItem } from '@/common/components/DirectMessages/ConversationListItem';
import { useDirectMessages, useDirectMessageThread } from '@/common/hooks/useDirectMessages';
import { DirectCastConversation, DirectCastGroup, DirectCastMessage } from '@/common/constants/directCast';
import { getUsernameForFid } from '@/common/helpers/farcaster';
import { useDataStore } from '@/stores/useDataStore';
import {
  extractFidsFromDMData,
  getSafeDisplayName,
  getSafeUsername,
  truncateText,
  getAvatarFallback,
} from '@/common/helpers/dmProfiles';

export enum DMTab {
  conversations = 'conversations',
  groups = 'groups',
  archived = 'archived',
}

const DirectMessages = () => {
  const router = useRouter();
  const { isNewCastModalOpen } = useNavigationStore();
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const [activeTab, setActiveTab] = useState<DMTab>(DMTab.conversations);
  const [selectedDMIdx, setSelectedDMIdx] = useState<number>(0);
  const [isChangingConversation, setIsChangingConversation] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  // Fetch DMs based on active tab
  const category = activeTab === DMTab.archived ? 'archived' : 'default';
  const { conversations, groups, isLoading, error, refresh } = useDirectMessages({
    category,
    enabled: !showOnboarding,
  });

  // Get cached user data and fetch function
  const { fidToData, fetchBulkProfiles } = useDataStore((state) => ({
    fidToData: state.fidToData,
    fetchBulkProfiles: state.fetchBulkProfiles,
  }));
  const getProfileByFid = (fid: number) => fidToData[fid];

  // Get current list based on active tab
  const getCurrentList = (): (DirectCastConversation | DirectCastGroup)[] => {
    switch (activeTab) {
      case DMTab.conversations:
        return conversations;
      case DMTab.groups:
        return groups;
      case DMTab.archived:
        // For archived, we combine both conversations and groups
        return [...conversations, ...groups];
      default:
        return [];
    }
  };

  const currentList = getCurrentList();

  // Get selected item details
  const selectedItem = currentList[selectedDMIdx];
  const selectedConversationId =
    selectedItem && 'conversationId' in selectedItem ? selectedItem.conversationId : undefined;
  const selectedGroupId = selectedItem && 'groupId' in selectedItem ? selectedItem.groupId : undefined;

  // Fetch messages for selected conversation/group
  const {
    messages,
    isLoading: messagesLoading,
    loadMore: loadMoreMessages,
    hasMore,
  } = useDirectMessageThread(selectedConversationId, selectedGroupId);

  // Collect all unique fids that need profiles from conversations and messages
  const allFidsToFetch = useMemo(() => {
    return extractFidsFromDMData(
      activeTab === DMTab.conversations ? conversations : [],
      activeTab === DMTab.groups ? groups : [],
      messages,
      Number(viewerFid)
    );
  }, [conversations, groups, messages, viewerFid, activeTab]);

  // Prefetch profiles for all visible fids using existing dataStore
  const [profilesLoading, setProfilesLoading] = useState(false);

  useEffect(() => {
    if (!showOnboarding && !isLoading && allFidsToFetch.length > 0 && viewerFid) {
      setProfilesLoading(true);
      fetchBulkProfiles(allFidsToFetch, viewerFid, true).finally(() => setProfilesLoading(false));
    }
  }, [allFidsToFetch, viewerFid, showOnboarding, isLoading, fetchBulkProfiles]);

  // Tab switching callback
  const changeTab = useCallback((tab: DMTab) => {
    setIsChangingConversation(true);
    setActiveTab(tab);
    setSelectedDMIdx(0);
    setTimeout(() => setIsChangingConversation(false), 300);
  }, []);

  // Stable callbacks for tab switching
  const switchToConversations = useCallback(() => changeTab(DMTab.conversations), [changeTab]);
  const switchToGroups = useCallback(() => changeTab(DMTab.groups), [changeTab]);
  const switchToArchived = useCallback(() => changeTab(DMTab.archived), [changeTab]);

  // Refresh callback
  const refreshDMs = useCallback(() => {
    refresh();
  }, [refresh]);

  // Select/open conversation
  const onSelect = useCallback(() => {
    if (selectedDMIdx >= 0 && currentList.length > selectedDMIdx) {
      const item = currentList[selectedDMIdx];
      // TODO: Implement actual navigation or show conversation
      console.log('Selected:', item);
    }
  }, [selectedDMIdx, currentList]);

  // Check if account has Farcaster API key
  useEffect(() => {
    const checkApiKey = async () => {
      if (selectedAccount) {
        console.log('[DMs Debug] Selected account:', {
          id: selectedAccount.id,
          name: selectedAccount.name,
          hasApiKey: !!selectedAccount.farcasterApiKey,
          platformAccountId: selectedAccount.platformAccountId,
        });

        // First check if API key is already loaded in memory
        if (selectedAccount.farcasterApiKey) {
          console.log('[DMs Debug] API key already in memory');
          setShowOnboarding(false);
          return;
        }

        console.log('[DMs Debug] API key not in memory, attempting to load from Supabase...');

        // Otherwise, try to load it from Supabase
        const { loadFarcasterApiKey } = useAccountStore.getState();
        await loadFarcasterApiKey(selectedAccount.id);

        // Check again after loading
        const updatedAccount = useAccountStore.getState().accounts[useAccountStore.getState().selectedAccountIdx];

        console.log('[DMs Debug] After loading attempt:', {
          hasApiKey: !!updatedAccount?.farcasterApiKey,
          showOnboarding: !updatedAccount?.farcasterApiKey,
        });

        setShowOnboarding(!updatedAccount?.farcasterApiKey);
      }
    };

    checkApiKey();
  }, [selectedAccount]);

  // Convert DirectCastMessage to Message format for MessageThread
  const convertedMessages: Message[] = messages.map((msg) => {
    const profile = getProfileByFid(msg.senderFid);
    return {
      id: msg.messageId,
      text: msg.message,
      senderFid: msg.senderFid,
      senderUsername: profile?.username || `fid:${msg.senderFid}`,
      senderDisplayName: profile?.displayName || profile?.username || `User ${msg.senderFid}`,
      senderPfpUrl: profile?.pfpUrl || '',
      timestamp: new Date(msg.creationTimestamp * 1000).toISOString(),
      isRead: true, // API doesn't provide read status, so we assume all are read
      isDeleted: msg.isDeleted,
    };
  });

  // Keyboard shortcuts
  useHotkeys(
    '1',
    switchToConversations,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToConversations]
  );

  useHotkeys(
    '2',
    switchToGroups,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToGroups]
  );

  useHotkeys(
    '3',
    switchToArchived,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [switchToArchived]
  );

  useHotkeys(
    'shift+r',
    refreshDMs,
    {
      enabled: !isNewCastModalOpen,
      enableOnFormTags: false,
      enableOnContentEditable: false,
    },
    [refreshDMs]
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

  // Render conversation/group row
  const renderDMRow = (item: DirectCastConversation | DirectCastGroup, idx: number) => {
    const handleClick = () => {
      if (idx !== selectedDMIdx) {
        setIsChangingConversation(true);
        setSelectedDMIdx(idx);
        setTimeout(() => setIsChangingConversation(false), 300);
      }
    };

    return (
      <ConversationListItem
        item={item}
        isSelected={idx === selectedDMIdx}
        onClick={handleClick}
        viewerFid={Number(viewerFid)}
        getProfileByFid={getProfileByFid}
        index={idx}
      />
    );
  };

  // Render selected conversation detail
  const renderSelectedDMDetail = () => {
    const selectedItem = currentList[selectedDMIdx];
    if (!selectedItem || !viewerFid) {
      return (
        <div className="flex-1 border-l border-muted flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground/60">Select a conversation to view messages</p>
          </div>
        </div>
      );
    }

    const isGroup = 'groupId' in selectedItem;
    let participantFid: number | undefined;
    let participantProfile: any;

    if (!isGroup) {
      participantFid = selectedItem.participantFids.find((fid) => fid !== Number(viewerFid));
      if (participantFid) {
        participantProfile = getProfileByFid(participantFid);
      }
    }

    return (
      <div
        className={cn(
          'flex-1 border-l border-muted flex flex-col',
          'transition-opacity duration-200',
          isChangingConversation ? 'opacity-0' : 'opacity-100'
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-muted/50 bg-muted/30">
          <div className="flex items-center gap-3">
            {isGroup ? (
              <>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{selectedItem.name}</h3>
                  <p className="text-xs text-foreground/60">{selectedItem.memberCount} members</p>
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participantProfile?.pfpUrl} />
                  <AvatarFallback>{getAvatarFallback(participantProfile, participantFid)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {getSafeDisplayName(participantProfile, participantFid)}
                  </h3>
                  <p className="text-xs text-foreground/60 truncate">
                    @{getSafeUsername(participantProfile, participantFid)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          <AnimatedMessageThread
            messages={convertedMessages}
            viewerFid={Number(viewerFid)}
            onLoadMore={loadMoreMessages}
            hasMore={hasMore}
            isLoading={messagesLoading}
            conversationKey={isGroup ? selectedItem.groupId : selectedItem.conversationId}
          />
        </div>
      </div>
    );
  };

  if (!viewerFid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-foreground/60">Please connect an account to view direct messages.</p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <DMsOnboarding
        onComplete={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <DMErrorBoundary>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="border-b border-muted px-4 py-3">
          <Tabs value={activeTab} onValueChange={(value) => changeTab(value as DMTab)}>
            <div className="flex items-center justify-between">
              <TabsList className="grid grid-cols-3 flex-1 mr-3">
                <TabsTrigger value={DMTab.conversations} className="text-xs transition-all duration-200">
                  <MessageSquare className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />
                  Conversations
                </TabsTrigger>
                <TabsTrigger value={DMTab.groups} className="text-xs transition-all duration-200">
                  <Users className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />
                  Groups
                </TabsTrigger>
                <TabsTrigger value={DMTab.archived} className="text-xs transition-all duration-200">
                  <Archive className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />
                  Archived
                </TabsTrigger>
              </TabsList>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-shrink-0 px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <KeyboardShortcutTooltip keys="shift+r">
                    <DropdownMenuItem onClick={refreshDMs} disabled={isLoading}>
                      <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                      Refresh
                    </DropdownMenuItem>
                  </KeyboardShortcutTooltip>
                  <DropdownMenuItem
                    onClick={() => {
                      // Placeholder for future implementation
                      console.log('Mark all as read clicked');
                    }}
                    disabled={isEmpty(currentList)}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      router.push('/settings');
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Tabs>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* DMs list (50% width) */}
          <div className="w-1/2 flex flex-col relative">
            <div
              className={cn(
                'flex-1 overflow-hidden transition-opacity duration-200',
                isChangingConversation && activeTab !== activeTab ? 'opacity-0' : 'opacity-100'
              )}
              ref={listContainerRef}
            >
              {error ? (
                <DMErrorState error={new Error(error)} onRetry={retryAfterError} accountId={selectedAccount?.id} />
              ) : isEmpty(currentList) && !isLoading ? (
                <DMEmptyState activeTab={activeTab} />
              ) : isLoading && isEmpty(currentList) ? (
                <DMLoadingState />
              ) : (
                <>
                  <SelectableListWithHotkeys
                    data={currentList}
                    selectedIdx={selectedDMIdx}
                    setSelectedIdx={setSelectedDMIdx}
                    renderRow={renderDMRow}
                    onSelect={onSelect}
                    isActive={!isNewCastModalOpen}
                    pinnedNavigation={true}
                    containerHeight="100%"
                  />
                  {profilesLoading && (
                    <div className="absolute top-2 right-2 text-xs text-foreground/60 bg-background/80 px-2 py-1 rounded">
                      Loading profiles...
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selected DM detail (50% width) */}
          {renderSelectedDMDetail()}
        </div>
      </div>
    </DMErrorBoundary>
  );
};

export default DirectMessages;
