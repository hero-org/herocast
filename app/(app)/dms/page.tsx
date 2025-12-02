'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAccountStore } from '@/stores/useAccountStore';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import isEmpty from 'lodash.isempty';
import { useHotkeys } from 'react-hotkeys-hook';
import { Loading } from '@/common/components/Loading';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
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
import { useBulkProfiles, getProfileFromBulk } from '@/hooks/queries/useBulkProfiles';
import { toast } from 'sonner';
import { HotkeyScopes } from '@/common/constants/hotkeys';

const DirectMessages = () => {
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
  const { conversations, groups, isLoading, error, errorCode, refresh, retryAfterError } = useDirectMessages({
    category,
    enabled: !showOnboarding,
  });

  useEffect(() => {
    if (errorCode === 'NO_API_KEY' || errorCode === 'INVALID_API_KEY') {
      setShowOnboarding(true);
    }
  }, [errorCode]);

  // Keep UI state management
  const updateSelectedProfileFid = useDataStore((state) => state.updateSelectedProfileFid);

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

  // Fetch profiles using React Query
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    isError: profilesError,
  } = useBulkProfiles(allFidsToFetch, {
    viewerFid: Number(viewerFid),
    enabled: !showOnboarding && allFidsToFetch.length > 0 && !!viewerFid,
  });

  // Helper to get profile by FID from bulk results
  const getProfileByFid = (fid: number) => getProfileFromBulk(profiles, fid);

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
      if (!selectedItem) {
        throw new Error('Cannot send message: no conversation selected');
      }

      // Don't prevent multiple sends - optimistic updates handle this
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
    [selectedItem, sendMessage]
  );

  // Handle starting a new conversation
  const handleStartConversation = useCallback(
    async (recipientFid: number, message: string) => {
      if (!selectedAccount?.id || !selectedAccount?.farcasterApiKey) {
        toast.error('No account available');
        return;
      }

      try {
        // Send message directly via API for new conversations
        // Don't use the sendMessage from useDirectMessageThread as it's tied to current conversation
        const response = await fetch(`/api/dms/messages?accountId=${selectedAccount.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientFid,
            message,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send message');
        }

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
    [selectedAccount, refresh]
  );

  const onSelect = useCallback(() => {
    // Selection is handled by the list - this is a placeholder for future navigation
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      if (selectedAccount) {
        if (selectedAccount.farcasterApiKey) {
          setShowOnboarding(false);
          return;
        }

        const { loadFarcasterApiKey } = useAccountStore.getState();
        await loadFarcasterApiKey(selectedAccount.id);

        const updatedAccount = useAccountStore.getState().accounts[useAccountStore.getState().selectedAccountIdx];
        setShowOnboarding(!updatedAccount?.farcasterApiKey);
      }
    };

    checkApiKey();
  }, [selectedAccount]);

  const convertedMessages: Message[] = messages.map((msg) => {
    const profile = getProfileByFid(msg.senderFid);

    let timestamp: string;
    if (!msg.creationTimestamp || msg.creationTimestamp === 0) {
      timestamp = new Date().toISOString();
    } else if (msg.creationTimestamp > 10000000000) {
      timestamp = new Date(msg.creationTimestamp).toISOString();
    } else {
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
          {isConversationChanging || (messagesLoading && messages.length === 0) ? (
            <MessageSkeleton />
          ) : (
            <MessageThread
              messages={convertedMessages}
              viewerFid={Number(viewerFid)}
              onLoadMore={loadMoreMessages}
              hasMore={hasMore}
              isLoading={messagesLoading}
              onSendMessage={handleSendMessage}
              isSending={false}
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
                  <DropdownMenuItem onClick={() => {}} disabled={isEmpty(currentList)}>
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
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
              ref={listContainerRef}
            >
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
                    scopes={[HotkeyScopes.GLOBAL, HotkeyScopes.DMS]}
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
        isLoading={false}
      />
    </DMErrorBoundary>
  );
};

export default DirectMessages;
