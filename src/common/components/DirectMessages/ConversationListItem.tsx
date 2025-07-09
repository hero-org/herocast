import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Users, MessageSquareOff } from 'lucide-react';
import ProfileHoverCard from './ProfileHoverCard';

interface ConversationListItemProps {
  isGroup: boolean;
  name?: string;
  participantProfile?: {
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  participantFid?: number;
  lastMessage?: {
    message: string;
    isDeleted: boolean;
    senderFid: number;
    creationTimestamp: number;
  };
  memberCount?: number;
  isSelected: boolean;
  viewerFid: number;
  onClick: () => void;
  getProfileByFid?: (fid: number) => any;
}

// Helper to truncate long text with ellipsis
const truncateText = (text: string, maxLength: number = 30) => {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + '...';
};

// Helper to get safe username
const getSafeUsername = (profile: any, fid?: number) => {
  if (profile?.username) {
    return truncateText(profile.username, 20);
  }
  return fid ? `fid:${fid}` : 'Unknown';
};

// Helper to get safe display name
const getSafeDisplayName = (profile: any, fid?: number) => {
  if (profile?.displayName && profile.displayName.trim()) {
    return truncateText(profile.displayName, 25);
  }
  if (profile?.username && profile.username.trim()) {
    return truncateText(profile.username, 25);
  }
  return fid ? `User ${fid}` : 'Unknown User';
};

// Helper to get avatar fallback
const getAvatarFallback = (profile: any, fid?: number, isGroup?: boolean) => {
  if (isGroup) return 'GC';

  if (profile?.username && profile.username.length >= 2) {
    return profile.username.slice(0, 2).toUpperCase();
  }
  if (profile?.displayName && profile.displayName.length >= 2) {
    return profile.displayName.slice(0, 2).toUpperCase();
  }
  if (fid) {
    return fid.toString().slice(0, 2);
  }
  return '??';
};

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  isGroup,
  name,
  participantProfile,
  participantFid,
  lastMessage,
  memberCount,
  isSelected,
  viewerFid,
  onClick,
  getProfileByFid,
}) => {
  const timeAgo = lastMessage ? formatDistanceToNowStrict(new Date(lastMessage.creationTimestamp * 1000)) : '';

  // Handle empty conversations
  const hasNoMessages = !lastMessage;

  return (
    <li
      className={cn(
        'flex gap-x-3 px-4 py-3 border-b border-muted/50 transition-colors border-l-2 cursor-pointer',
        isSelected ? 'bg-muted border-l-blue-500' : 'bg-background/80 hover:bg-muted/50 border-l-transparent'
      )}
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        {isGroup ? (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          <ProfileHoverCard fid={participantFid} username={participantProfile?.username} viewerFid={viewerFid}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={participantProfile?.pfpUrl} />
              <AvatarFallback>{getAvatarFallback(participantProfile, participantFid, false)}</AvatarFallback>
            </Avatar>
          </ProfileHoverCard>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-x-2">
          {isGroup ? (
            <p className="text-sm font-medium text-foreground truncate">{truncateText(name || 'Unnamed Group', 30)}</p>
          ) : (
            <ProfileHoverCard fid={participantFid} username={participantProfile?.username} viewerFid={viewerFid}>
              <p className="text-sm font-medium text-foreground truncate">
                {getSafeDisplayName(participantProfile, participantFid)}
              </p>
            </ProfileHoverCard>
          )}
          {timeAgo && <p className="flex-none text-xs text-foreground/60">{timeAgo}</p>}
        </div>
        {hasNoMessages ? (
          <div className="mt-0.5 flex items-center gap-1">
            <MessageSquareOff className="h-3 w-3 text-foreground/40" />
            <p className="text-sm text-foreground/50 italic">No messages yet</p>
          </div>
        ) : lastMessage ? (
          <p className="mt-0.5 text-sm text-foreground/70 truncate">
            {isGroup && lastMessage.senderFid !== viewerFid && getProfileByFid && (
              <span className="text-foreground/50">
                @{getSafeUsername(getProfileByFid(lastMessage.senderFid), lastMessage.senderFid)}:
              </span>
            )}
            {lastMessage.isDeleted ? (
              <span className="italic text-foreground/50">Message deleted</span>
            ) : !lastMessage.message?.trim() ? (
              <span className="italic text-foreground/50">Empty message</span>
            ) : (
              truncateText(lastMessage.message, 60)
            )}
          </p>
        ) : null}
        {isGroup && memberCount !== undefined && (
          <p className="text-xs text-foreground/50 mt-0.5">{memberCount} members</p>
        )}
      </div>
    </li>
  );
};
