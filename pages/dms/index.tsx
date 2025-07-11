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
import { MoreHorizontal, RefreshCw, MessageSquare, Users, Archive, CheckCheck, Settings, Plus } from 'lucide-react';
import { KeyboardShortcutTooltip } from '@/components/ui/keyboard-shortcut-tooltip';
import { MessageThread, Message } from '@/common/components/DirectMessages/MessageThread';
import { MessageSkeleton } from '@/common/components/DirectMessages/MessageSkeleton';
import { DMsOnboarding } from '@/common/components/DirectMessages/DMsOnboarding';
import { DMErrorBoundary } from '@/common/components/DirectMessages/DMErrorBoundary';
import { DMLoadingState } from '@/common/components/DirectMessages/DMLoadingState';
import { DMEmptyState, DMTab } from '@/common/components/DirectMessages/DMEmptyState';
import { DMErrorState } from '@/common/components/DirectMessages/DMErrorState';
import { ConversationListItem } from '@/common/components/DirectMessages/ConversationListItem';
import { NewConversationDialog } from '@/common/components/DirectMessages/NewConversationDialog';
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
import { toast } from 'sonner';

const DirectMessages = () => {
  const router = useRouter();
  const { isNewCastModalOpen } = useNavigationStore();
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const [activeTab, setActiveTab] = useState<DMTab>(DMTab.conversations);
  const [selectedDMIdx, setSelectedDMIdx] = useState<number>(0);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [previousConversationId, setPreviousConversationId] = useState<string | undefined>(undefined);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [showNewConversation, setShowNewConversation] = useState<boolean>(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  // Fetch DMs based on active tab
  const category = activeTab === DMTab.archived ? 'archived' : 'default';
  const { conversations, groups, isLoading, error, refresh, retryAfterError } = useDirectMessages({
    category,
    enabled: !showOnboarding,
  });

  // Get cached user data and fetch function
  const { fidToData, fetchBulkProfiles, updateSelectedProfileFid } = useDataStore((state) => ({
    fidToData: state.fidToData,
    fetchBulkProfiles: state.fetchBulkProfiles,
    updateSelectedProfileFid: state.updateSelectedProfileFid,
  }));
  const getProfileByFid = (fid: number) => fidToData[fid];

  // Helper to get unique ID for an item
  const getItemId = (item: DirectCastConversation | DirectCastGroup) => {
    if ('conversationId' in item) {
      return item.conversationId;
    }
    return item.groupId;
  };

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

  // Add id property to items for SelectableListWithHotkeys
  const currentList = getCurrentList().map((item) => ({
    ...item,
    id: getItemId(item),
  }));

  // Get selected item details
  const selectedItem = currentList[selectedDMIdx];
  const selectedConversationId =
    selectedItem && 'conversationId' in selectedItem ? selectedItem.conversationId : undefined;
  const selectedGroupId = selectedItem && 'groupId' in selectedItem ? selectedItem.groupId : undefined;

  // Determine the current conversation key
  const currentConversationKey = selectedConversationId || selectedGroupId;

  // Fetch messages for selected conversation/group
  const {
    messages,
    isLoading: messagesLoading,
    loadMore: loadMoreMessages,
    hasMore,
    refresh: refreshMessages,
    sendMessage,
  } = useDirectMessageThread(selectedConversationId, selectedGroupId);

  // Track conversation changes
  const isConversationChanging = currentConversationKey !== previousConversationId;

  useEffect(() => {
    if (currentConversationKey && currentConversationKey !== previousConversationId) {
      setPreviousConversationId(currentConversationKey);
    }
  }, [currentConversationKey, previousConversationId]);

  // Update selectedProfileFid when conversation changes
  useEffect(() => {
    if (selectedItem && viewerFid) {
      // For conversations, set the other participant's FID
      if ('conversationId' in selectedItem) {
        const participantFid = selectedItem.participantFids.find((fid) => fid !== Number(viewerFid));
        if (participantFid) {
          updateSelectedProfileFid(participantFid);
        }
      }
      // For groups, we don't set a specific profile (could show group info in future)
      else if ('groupId' in selectedItem) {
        updateSelectedProfileFid(undefined);
      }
    } else {
      updateSelectedProfileFid(undefined);
    }
  }, [selectedItem, viewerFid, updateSelectedProfileFid]);

  // Clear selectedProfileFid when leaving the page
  useEffect(() => {
    return () => {
      updateSelectedProfileFid(undefined);
    };
  }, [updateSelectedProfileFid]);

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
      console.log('[DMs Profile Fetch Debug]', {
        allFidsToFetch,
        viewerFid,
        conversationsCount: conversations.length,
        groupsCount: groups.length,
        messagesCount: messages.length,
      });
      setProfilesLoading(true);
      fetchBulkProfiles(allFidsToFetch, viewerFid, true).finally(() => setProfilesLoading(false));
    }
  }, [allFidsToFetch, viewerFid, showOnboarding, isLoading, fetchBulkProfiles]);

  // Tab switching callback
  const changeTab = useCallback((tab: DMTab) => {
    setActiveTab(tab);
    setSelectedDMIdx(0);
  }, []);

  // Stable callbacks for tab switching
  const switchToConversations = useCallback(() => changeTab(DMTab.conversations), [changeTab]);
  const switchToGroups = useCallback(() => changeTab(DMTab.groups), [changeTab]);
  const switchToArchived = useCallback(() => changeTab(DMTab.archived), [changeTab]);

  // Refresh callback
  const refreshDMs = useCallback(() => {
    refresh();
  }, [refresh]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!selectedItem || isSendingMessage) {
        throw new Error('Cannot send message: invalid state');
      }

      setIsSendingMessage(true);

      try {
        // Use the sendMessage function from the hook which handles optimistic updates
        await sendMessage(message);
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message', {
          description: error instanceof Error ? error.message : 'Please try again',
          action: {
            label: 'Retry',
            onClick: () => handleSendMessage(message),
          },
        });
      } finally {
        setIsSendingMessage(false);
      }
    },
    [selectedItem, isSendingMessage, sendMessage]
  );

  // Handle starting a new conversation
  const handleStartConversation = useCallback(
    async (recipientFid: number, message: string) => {
      try {
        // Use the sendMessage function with recipientFid option
        const result = await sendMessage(message, { recipientFid });

        // Refresh conversations to show the new one
        refresh();

        // Close dialog on success
        setShowNewConversation(false);

        toast.success('Conversation started');
      } catch (error) {
        console.error('Error starting conversation:', error);
        toast.error('Failed to start conversation', {
          description: error instanceof Error ? error.message : 'Please try again',
        });
        // Don't close dialog on error, let user retry
      }
    },
    [sendMessage, refresh]
  );

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

    // Debug timestamp issues
    if (msg.creationTimestamp) {
      console.log('Message timestamp debug:', {
        messageId: msg.messageId,
        creationTimestamp: msg.creationTimestamp,
        timestampInMs: msg.creationTimestamp * 1000,
        date: new Date(msg.creationTimestamp * 1000),
        isoString: new Date(msg.creationTimestamp * 1000).toISOString(),
      });
    } else {
      console.log('Message has no timestamp:', {
        messageId: msg.messageId,
        creationTimestamp: msg.creationTimestamp,
        message: msg,
      });
    }

    // Handle edge cases for timestamp
    let timestamp: string;
    if (!msg.creationTimestamp || msg.creationTimestamp === 0) {
      // Fallback to current time if timestamp is missing
      timestamp = new Date().toISOString();
      console.warn('Message has no timestamp, using current time:', msg.messageId);
    } else if (msg.creationTimestamp > 10000000000) {
      // If timestamp is already in milliseconds (has more than 10 digits)
      timestamp = new Date(msg.creationTimestamp).toISOString();
      console.warn('Timestamp appears to be in milliseconds already:', msg.messageId);
    } else {
      // Normal case: timestamp is in seconds
      timestamp = new Date(msg.creationTimestamp * 1000).toISOString();
    }

    return {
      id: msg.messageId,
      text: msg.message,
      senderFid: msg.senderFid,
      senderUsername: profile?.username || `fid:${msg.senderFid}`,
      senderDisplayName: profile?.display_name || profile?.username || `User ${msg.senderFid}`,
      senderPfpUrl: profile?.pfp_url || '',
      timestamp,
      isRead: true, // API doesn't provide read status, so we assume all are read
      isDeleted: msg.isDeleted,
      // Include optimistic message properties if they exist
      _optimistic: (msg as any)._optimistic,
      _status: (msg as any)._status,
      _error: (msg as any)._error,
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

  useHotkeys(
    'cmd+n,ctrl+n',
    () => setShowNewConversation(true),
    {
      enabled: !isNewCastModalOpen && activeTab === DMTab.conversations && !showNewConversation,
      enableOnFormTags: false,
      preventDefault: true,
      enableOnContentEditable: false,
    },
    [activeTab, showNewConversation]
  );

  // Render conversation/group row
  const renderDMRow = (item: DirectCastConversation | DirectCastGroup, idx: number) => {
    const handleClick = () => {
      if (idx !== selectedDMIdx) {
        setSelectedDMIdx(idx);
      }
    };

    // Add id property for SelectableListWithHotkeys
    const itemWithId = { ...item, id: getItemId(item) };

    return (
      <ConversationListItem
        item={itemWithId}
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
        <div className="flex items-center justify-center h-full">
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
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-muted/50 bg-muted/30 transition-all duration-50 flex-shrink-0">
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
                  <AvatarImage src={participantProfile?.pfp_url} />
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

        {/* Messages area - explicit height constraint using viewport calculation */}
        <div className="flex-1 min-h-0 h-0 max-h-[calc(100vh-10rem)]">
          {(isConversationChanging || messagesLoading) && messages.length === 0 ? (
            <MessageSkeleton />
          ) : (
            <MessageThread
              messages={convertedMessages}
              viewerFid={Number(viewerFid)}
              onLoadMore={loadMoreMessages}
              hasMore={hasMore}
              isLoading={messagesLoading}
              onSendMessage={handleSendMessage}
              isSending={isSendingMessage}
              isReadOnly={false}
            />
          )}
        </div>
      </div>
    );
  };

  if (!viewerFid) {
    return (
      <div className="flex items-center justify-center h-full overflow-hidden">
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
      <div className="flex flex-col h-full bg-background">
        {/* Compact DMs Header */}
        <div className="border-b border-muted px-4 py-2 flex-shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">Direct Messages</h1>
            <div className="flex items-center gap-2">
              <KeyboardShortcutTooltip keys="cmd+n">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewConversation(true)}
                  disabled={activeTab !== DMTab.conversations}
                  className="h-8 px-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline">New</span>
                </Button>
              </KeyboardShortcutTooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-muted px-4 py-2 flex-shrink-0">
          <Tabs value={activeTab} onValueChange={(value) => changeTab(value as DMTab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value={DMTab.conversations} className="text-xs transition-all duration-50">
                <MessageSquare className="h-3 w-3 mr-1 transition-transform duration-50 group-hover:scale-110" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value={DMTab.groups} className="text-xs transition-all duration-50">
                <Users className="h-3 w-3 mr-1 transition-transform duration-50 group-hover:scale-110" />
                Groups
              </TabsTrigger>
              <TabsTrigger value={DMTab.archived} className="text-xs transition-all duration-50">
                <Archive className="h-3 w-3 mr-1 transition-transform duration-50 group-hover:scale-110" />
                Archived
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* DMs list - fixed width sidebar */}
          <div className="w-56 lg:w-64 flex-shrink-0 flex flex-col relative border-r border-muted">
            <div className="flex-1 overflow-y-auto" ref={listContainerRef}>
              {error ? (
                <DMErrorState error={new Error(error)} onRetry={retryAfterError} />
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

          {/* Selected DM detail - flex container for proper layout */}
          <div className="flex-1 flex flex-col overflow-hidden">{renderSelectedDMDetail()}</div>
        </div>
      </div>

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onStartConversation={handleStartConversation}
        viewerFid={viewerFid}
        isLoading={isSendingMessage}
      />
    </DMErrorBoundary>
  );
};

export default DirectMessages;
