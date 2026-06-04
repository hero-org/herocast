'use client';

import { Radio, Users } from 'lucide-react';
import type React from 'react';
import type { AudioRoom } from '@/common/types/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { spaceUserInitials, spaceUserName, spaceUserPfp } from './SpaceParticipant';

interface LiveRoomCardProps {
  room: AudioRoom;
  onJoin: (roomId: string) => void;
}

function formatListeners(count: number | undefined): string {
  const n = count ?? 0;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** A single live-room card: title, host, listener count, LIVE pill. */
const LiveRoomCard: React.FC<LiveRoomCardProps> = ({ room, onJoin }) => {
  return (
    <button
      type="button"
      onClick={() => onJoin(room.id)}
      className={cn(
        'group flex w-64 shrink-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left',
        'shadow-sm transition-colors duration-fast hover:bg-accent'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
          <Radio className="h-3 w-3" />
          Live
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {formatListeners(room.listenerCount)}
        </span>
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
        {room.title?.trim() || 'Untitled space'}
      </p>

      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={spaceUserPfp(room.host)} alt={spaceUserName(room.host)} />
          <AvatarFallback className="text-[10px] font-medium">{spaceUserInitials(room.host)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-xs text-muted-foreground">{spaceUserName(room.host)}</span>
      </div>
    </button>
  );
};

interface LiveSpacesStripProps {
  rooms: AudioRoom[];
  onJoin: (roomId: string) => void;
  className?: string;
}

/** Horizontal carousel of live rooms. */
export const LiveSpacesStrip: React.FC<LiveSpacesStripProps> = ({ rooms, onJoin, className }) => {
  if (rooms.length === 0) return null;

  return (
    <ScrollArea className={cn('w-full whitespace-nowrap', className)}>
      <div className="flex gap-4 pb-4">
        {rooms.map((room) => (
          <LiveRoomCard key={room.id} room={room} onJoin={onJoin} />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export { formatListeners };
