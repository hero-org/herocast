import { DirectCastConversation, DirectCastGroup, DirectCastMessage } from '@/common/constants/directCast';

/**
 * Extract all unique FIDs from conversations, groups, and messages
 * that need profile data.
 */
export function extractFidsFromDMData(
  conversations: DirectCastConversation[],
  groups: DirectCastGroup[],
  messages: DirectCastMessage[],
  viewerFid?: number
): number[] {
  const fids = new Set<number>();

  // Always include viewer FID to ensure optimistic updates work
  if (viewerFid) {
    fids.add(viewerFid);
  }

  // Extract from conversations
  conversations.forEach((conv) => {
    conv.participantFids?.forEach((fid) => {
      if (fid) {
        fids.add(fid);
      }
    });

    if (conv.lastMessage?.senderFid) {
      fids.add(conv.lastMessage.senderFid);
    }
  });

  // Extract from groups - currently we don't have member fids exposed
  // but we can get the last message sender
  groups.forEach((group) => {
    if (group.lastMessage?.senderFid) {
      fids.add(group.lastMessage.senderFid);
    }
    // In the future, when member fids are available:
    // group.memberFids?.forEach(fid => fids.add(fid));
  });

  // Extract from messages
  messages.forEach((msg) => {
    if (msg.senderFid) {
      fids.add(msg.senderFid);
    }
  });

  return Array.from(fids);
}

/**
 * Helper to safely get profile display name with fallback
 */
export function getSafeDisplayName(profile: any, fid?: number, maxLength: number = 25): string {
  const displayName = profile?.display_name?.trim() || profile?.username?.trim();

  if (displayName) {
    return truncateText(displayName, maxLength);
  }

  return fid ? `User ${fid}` : 'Unknown User';
}

/**
 * Helper to safely get username with @ prefix
 */
export function getSafeUsername(profile: any, fid?: number, maxLength: number = 20): string {
  if (profile?.username?.trim()) {
    return truncateText(profile.username, maxLength);
  }

  return fid ? `fid:${fid}` : 'Unknown';
}

/**
 * Helper to truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + '...';
}

/**
 * Get avatar fallback text for profile
 */
export function getAvatarFallback(profile: any, fid?: number, isGroup: boolean = false): string {
  if (isGroup) return 'GC';

  const name = profile?.username || profile?.display_name;
  if (name && name.length >= 2) {
    return name.slice(0, 2).toUpperCase();
  }

  if (fid) {
    return fid.toString().slice(0, 2);
  }

  return '??';
}
