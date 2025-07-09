import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, MessageSquareOff } from 'lucide-react';
import { DMErrorBoundary } from './DMErrorBoundary';
import { useSmoothScroll } from '@/common/hooks/useSmoothScroll';
import ProfileHoverCard from './ProfileHoverCard';

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
}

interface MessageThreadProps {
  messages: Message[];
  viewerFid: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

import { MessageBubble } from './MessageBubble';

const MessageThreadContent: React.FC<MessageThreadProps> = ({
  messages,
  viewerFid,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { scrollToElement } = useSmoothScroll();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToElement(messagesEndRef.current, { block: 'end' });
    }
  }, [messages.length, scrollToElement]);
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

  const messageGroups = groupMessagesByUser(messages);

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
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
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
        {messageGroups.map((group, groupIdx) => {
          const isViewer = group.sender.senderFid === viewerFid;
          return (
            <div
              key={`group-${groupIdx}`}
              className={cn(
                'flex gap-3 animate-in fade-in-0 slide-up duration-300',
                isViewer ? 'flex-row-reverse' : 'flex-row'
              )}
              style={{ animationDelay: `${groupIdx * 50}ms`, animationFillMode: 'both' }}
            >
              {/* Avatar */}
              {!isViewer && (
                <ProfileHoverCard
                  fid={group.sender.senderFid}
                  username={group.sender.senderUsername}
                  viewerFid={viewerFid}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0 transition-transform duration-200 hover:scale-110">
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
                  <MessageBubble
                    key={message.id}
                    text={message.text}
                    isViewer={isViewer}
                    isDeleted={message.isDeleted}
                    timestamp={
                      idx === group.messages.length - 1
                        ? formatDistanceToNowStrict(new Date(message.timestamp)) + ' ago'
                        : undefined
                    }
                    showTimestamp={idx === group.messages.length - 1}
                  />
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

      {/* Input area placeholder */}
      <div className="border-t border-muted px-4 py-3">
        <div className="bg-muted rounded-lg px-4 py-3 text-foreground/60 text-sm text-center">
          Read-only mode - Sending messages coming soon
        </div>
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
