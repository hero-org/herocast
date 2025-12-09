import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, MessageSquareOff } from 'lucide-react';
import { DMErrorBoundary } from './DMErrorBoundary';
import { useSmoothScroll } from '@/common/hooks/useSmoothScroll';
import ProfileHoverCard from './ProfileHoverCard';
import { MessageInput } from './MessageInput';
import { MessageStatus } from './MessageStatus';

export interface Message {
  id: string;
  text: string;
  senderFid: number;
  senderUsername: string;
  senderDisplayName: string;
  senderPfpUrl: string;
  timestamp: string;
  isRead: boolean;
  isDeleted?: boolean;
  _optimistic?: boolean;
  _status?: 'pending' | 'sent' | 'failed';
  _error?: string;
}

interface MessageThreadProps {
  messages: Message[];
  viewerFid: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  onSendMessage?: (message: string) => Promise<void>;
  isSending?: boolean;
  isReadOnly?: boolean;
}

import { MessageBubble } from './MessageBubble';

const MessageThreadContent: React.FC<MessageThreadProps> = ({
  messages,
  viewerFid,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  onSendMessage,
  isSending = false,
  isReadOnly = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { scrollToElement } = useSmoothScroll();

  // Auto-scroll to bottom when new messages arrive - instant scroll
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages.length]);
  const groupMessagesByUser = (messages: Message[]) => {
    const groups: Array<{ sender: Message; messages: Message[] }> = [];
    let currentGroup: { sender: Message; messages: Message[] } | null = null;

    messages.forEach((message) => {
      if (!currentGroup || currentGroup.sender.senderFid !== message.senderFid) {
        currentGroup = { sender: message, messages: [message] };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  };

  // Sort messages by timestamp (oldest first)
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  const messageGroups = groupMessagesByUser(sortedMessages);

  // Helper to get display name with fallback
  const getDisplayName = (message: Message) => {
    if (message.senderDisplayName && message.senderDisplayName.trim()) {
      return message.senderDisplayName;
    }
    if (message.senderUsername && message.senderUsername.trim()) {
      return `@${message.senderUsername}`;
    }
    return `User ${message.senderFid}`;
  };

  // Helper to get avatar fallback
  const getAvatarFallback = (message: Message) => {
    if (message.senderUsername && message.senderUsername.length >= 2) {
      return message.senderUsername.slice(0, 2).toUpperCase();
    }
    if (message.senderDisplayName && message.senderDisplayName.length >= 2) {
      return message.senderDisplayName.slice(0, 2).toUpperCase();
    }
    return message.senderFid.toString().slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {/* Message groups */}
        {messageGroups.map((group) => {
          const isViewer = group.sender.senderFid === viewerFid;
          // Use first message ID as stable key for the group
          const groupKey = `group-${group.messages[0].id}`;
          return (
            <div key={groupKey} className={cn('flex gap-3', isViewer ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              {!isViewer && (
                <ProfileHoverCard
                  fid={group.sender.senderFid}
                  username={group.sender.senderUsername}
                  viewerFid={viewerFid}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={group.sender.senderPfpUrl} />
                    <AvatarFallback>{getAvatarFallback(group.sender)}</AvatarFallback>
                  </Avatar>
                </ProfileHoverCard>
              )}

              {/* Messages */}
              <div className={cn('flex flex-col gap-1 max-w-[70%]', isViewer ? 'items-end' : 'items-start')}>
                {/* Sender name (only for non-viewer) */}
                {!isViewer && (
                  <ProfileHoverCard
                    fid={group.sender.senderFid}
                    username={group.sender.senderUsername}
                    viewerFid={viewerFid}
                  >
                    <span className="text-xs text-foreground/60 px-3 truncate max-w-full cursor-pointer hover:text-foreground/80">
                      {getDisplayName(group.sender)}
                    </span>
                  </ProfileHoverCard>
                )}

                {/* Message bubbles */}
                {group.messages.map((message, idx) => (
                  <div key={message.id} className="flex flex-col gap-1">
                    <MessageBubble
                      text={message.text}
                      isViewer={isViewer}
                      isDeleted={message.isDeleted}
                      timestamp={
                        idx === group.messages.length - 1
                          ? (() => {
                              try {
                                const date = new Date(message.timestamp);
                                // Check if date is valid
                                if (isNaN(date.getTime())) {
                                  console.warn('Invalid timestamp for message:', message.id, message.timestamp);
                                  return 'just now';
                                }
                                return formatDistanceToNowStrict(date) + ' ago';
                              } catch (error) {
                                console.error('Error formatting timestamp:', error, message.id);
                                return 'just now';
                              }
                            })()
                          : undefined
                      }
                      showTimestamp={idx === group.messages.length - 1 && !message._optimistic}
                    />
                    {/* Status indicator for optimistic messages */}
                    {message._optimistic && (
                      <MessageStatus
                        status={message._status}
                        error={message._error}
                        className={cn('mt-1', isViewer ? 'self-end mr-3' : 'self-start ml-3')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-foreground/60 gap-3">
            <MessageSquareOff className="h-12 w-12 text-muted-foreground" />
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-muted px-4 py-3 bg-background">
        {isReadOnly ? (
          <div className="bg-muted rounded-lg px-4 py-3 text-foreground/60 text-sm text-center">Read-only mode</div>
        ) : (
          <MessageInput
            onSend={onSendMessage || (async () => {})}
            disabled={!onSendMessage}
            isLoading={isSending}
            placeholder={onSendMessage ? 'Type a message...' : 'Sending messages coming soon'}
          />
        )}
      </div>
    </div>
  );
};

export const MessageThread: React.FC<MessageThreadProps> = (props) => {
  return (
    <DMErrorBoundary>
      <MessageThreadContent {...props} />
    </DMErrorBoundary>
  );
};
