import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Users, MessageSquareOff } from 'lucide-react';
import ProfileHoverCard from './ProfileHoverCard';
import { DirectCastConversation, DirectCastGroup } from '@/common/constants/directCast';

interface ConversationListItemProps {
  item: DirectCastConversation | DirectCastGroup;
  isSelected: boolean;
  viewerFid: number;
  onClick: () => void;
  getProfileByFid: (fid: number) => any;
  index: number;
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
  if (profile?.display_name && profile.display_name.trim()) {
    return truncateText(profile.display_name, 25);
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
  if (profile?.display_name && profile.display_name.length >= 2) {
    return profile.display_name.slice(0, 2).toUpperCase();
  }
  if (fid) {
    return fid.toString().slice(0, 2);
  }
  return '??';
};

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  item,
  isSelected,
  viewerFid,
  onClick,
  getProfileByFid,
  index,
}) => {
  // Determine if it's a group
  const isGroup = 'groupId' in item;

  // Extract data based on type
  let participantFid: number | undefined;
  let participantProfile: any;
  let name: string | undefined;
  let memberCount: number | undefined;
  const lastMessage = item.lastMessage;

  if (isGroup) {
    name = item.name;
    memberCount = item.memberCount;
  } else {
    // For conversations, find the other participant
    participantFid = item.participantFids.find((fid) => fid !== viewerFid);
    if (participantFid) {
      participantProfile = getProfileByFid(participantFid);
      // Debug logging
      if (index === 0) {
        console.log('[ConversationListItem Debug]', {
          participantFid,
          participantProfile,
          hasProfile: !!participantProfile,
          displayName: participantProfile?.display_name,
          username: participantProfile?.username,
        });
      }
    }
  }

  // Handle timestamp edge cases
  let timeAgo = '';
  if (lastMessage) {
    let timestamp: Date;
    if (!lastMessage.creationTimestamp || lastMessage.creationTimestamp === 0) {
      // Fallback to current time if timestamp is missing
      timestamp = new Date();
    } else if (lastMessage.creationTimestamp > 10000000000) {
      // If timestamp is already in milliseconds (has more than 10 digits)
      timestamp = new Date(lastMessage.creationTimestamp);
    } else {
      // Normal case: timestamp is in seconds
      timestamp = new Date(lastMessage.creationTimestamp * 1000);
    }
    timeAgo = formatDistanceToNowStrict(timestamp);
  }

  // Handle empty conversations
  const hasNoMessages = !lastMessage;

  return (
    <li
      className={cn(
        'flex gap-x-3 px-4 py-3 border-b border-muted/50 transition-colors duration-50 border-l-2 cursor-pointer min-w-0',
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
              <AvatarImage src={participantProfile?.pfp_url} />
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
              truncateText(lastMessage.message, 40)
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
