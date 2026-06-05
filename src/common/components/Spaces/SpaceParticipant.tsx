'use client';

import { MicOff } from 'lucide-react';
import type React from 'react';
import type { SpaceUser } from '@/common/types/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** Resolve the best avatar url from a denormalized SpaceUser. */
export function spaceUserPfp(user: SpaceUser | undefined): string | undefined {
  return user?.pfp?.url || user?.pfpUrl || undefined;
}

/** Resolve a human display name, degrading to username then `fid:<n>`. */
export function spaceUserName(user: SpaceUser | undefined): string {
  if (!user) return 'Unknown';
  const display = user.displayName?.trim();
  if (display) return display;
  const username = user.username?.trim();
  if (username) return username;
  return `fid:${user.fid}`;
}

/** Two-character avatar fallback initials. */
export function spaceUserInitials(user: SpaceUser | undefined): string {
  if (!user) return '??';
  const source = user.displayName?.trim() || user.username?.trim();
  if (source && source.length >= 2) return source.slice(0, 2).toUpperCase();
  return String(user.fid).slice(0, 2);
}

type ParticipantSize = 'sm' | 'lg';

const AVATAR_SIZE: Record<ParticipantSize, string> = {
  sm: 'h-10 w-10',
  lg: 'h-16 w-16',
};

interface SpaceParticipantProps {
  user: SpaceUser;
  /** Whether this participant may publish audio (host/cohost/speaker). */
  canSpeak?: boolean;
  /** Whether this participant is currently the active speaker. */
  isActiveSpeaker?: boolean;
  /** Whether this participant has muted their mic (only meaningful if canSpeak). */
  muted?: boolean;
  /** Optional role label shown under the name (e.g. "Host"). */
  roleLabel?: string;
  size?: ParticipantSize;
  className?: string;
}

/**
 * A single participant tile: avatar with an active-speaker ring, an optional
 * muted badge for speakers, and name + role label. Used in the room grid and
 * (avatar-only) in the live bar's speaker stack.
 */
export const SpaceParticipant: React.FC<SpaceParticipantProps> = ({
  user,
  canSpeak = false,
  isActiveSpeaker = false,
  muted = false,
  roleLabel,
  size = 'sm',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center gap-1.5 text-center', className)}>
      <div className="relative">
        <Avatar
          className={cn(
            AVATAR_SIZE[size],
            'ring-offset-2 ring-offset-background transition-shadow duration-fast',
            isActiveSpeaker ? 'ring-2 ring-success' : 'ring-1 ring-border'
          )}
        >
          <AvatarImage src={spaceUserPfp(user)} alt={spaceUserName(user)} />
          <AvatarFallback className="text-xs font-medium">{spaceUserInitials(user)}</AvatarFallback>
        </Avatar>
        {canSpeak && muted && (
          <span
            role="img"
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground"
            aria-label="Muted"
          >
            <MicOff className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 max-w-[5.5rem] flex-col">
        <span className="truncate text-xs font-medium text-foreground">{spaceUserName(user)}</span>
        {roleLabel && <span className="truncate text-[11px] text-muted-foreground">{roleLabel}</span>}
      </div>
    </div>
  );
};
