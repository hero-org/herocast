'use client';

import { ChevronUp, LogOut, Mic, MicOff, Radio, Users } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { SPACES_ENABLED } from '@/common/constants/spaces';
import type { AudioRoomParticipant, SpaceSession } from '@/common/types/spaces';
import { canPublish } from '@/common/types/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSpacesStore } from '@/stores/useSpacesStore';
import { formatListeners } from './LiveSpacesStrip';
import { spaceUserInitials, spaceUserName, spaceUserPfp } from './SpaceParticipant';
import { SpaceRoomView } from './SpaceRoomView';

/** Max speaker avatars in the bar's stack before truncating. */
const MAX_STACK = 3;

function pickStackSpeakers(participants: AudioRoomParticipant[], activeFids: number[]): AudioRoomParticipant[] {
  const speakers = participants.filter((p) => canPublish(p.role));
  const active = new Set(activeFids);
  // Prioritize active speakers, then the rest, preserving order.
  return [...speakers.filter((p) => active.has(p.user.fid)), ...speakers.filter((p) => !active.has(p.user.fid))].slice(
    0,
    MAX_STACK
  );
}

interface LiveSpaceBarBodyProps {
  session: SpaceSession;
}

const LiveSpaceBarBody: React.FC<LiveSpaceBarBodyProps> = ({ session }) => {
  const setExpanded = useSpacesStore((s) => s.setExpanded);
  const toggleMic = useSpacesStore((s) => s.toggleMic);
  const leave = useSpacesStore((s) => s.leave);
  const micError = useSpacesStore((s) => s.micError);

  const { room, role, participants, activeSpeakerFids, muted, connState } = session;
  const activeSet = useMemo(() => new Set(activeSpeakerFids), [activeSpeakerFids]);
  const stack = useMemo(() => pickStackSpeakers(participants, activeSpeakerFids), [participants, activeSpeakerFids]);
  const userCanPublish = canPublish(role);

  const expand = () => setExpanded(true);

  return (
    // NOTE: `lg:left-[200px]` clears the fixed left sidebar at its default
    // expanded width (see src/home/index.tsx). When the sidebar is collapsed
    // this leaves a gap on desktop — acceptable for v1; a design-review
    // follow-up could thread the sidebar-open state through here.
    <div
      className={cn(
        'pointer-events-auto fixed bottom-0 left-0 right-0 z-modal lg:left-[200px]',
        'border-t border-border bg-card/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80'
      )}
      role="region"
      aria-label="Active space"
    >
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        {/* Tap-to-expand: live indicator + title + speaker stack */}
        <button
          type="button"
          onClick={expand}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition-colors duration-fast hover:bg-accent/60"
          aria-label="Expand space"
        >
          <span className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Radio className="h-4 w-4" />
          </span>

          <div className="flex -space-x-2">
            {stack.map((p) => {
              const speaking = activeSet.has(p.user.fid);
              return (
                <Avatar
                  key={p.user.fid}
                  className={cn(
                    'h-8 w-8 border-2 border-card ring-offset-1 ring-offset-card',
                    speaking && 'ring-2 ring-success'
                  )}
                >
                  <AvatarImage src={spaceUserPfp(p.user)} alt={spaceUserName(p.user)} />
                  <AvatarFallback className="text-[10px] font-medium">{spaceUserInitials(p.user)}</AvatarFallback>
                </Avatar>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{room.title?.trim() || 'Untitled space'}</p>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {connState === 'degraded' || connState === 'reconnecting' ? (
                <span className="text-warning">Reconnecting…</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-destructive">
                  Live
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {formatListeners(room.listenerCount ?? participants.length)}
              </span>
            </span>
          </div>

          <ChevronUp className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
        </button>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {userCanPublish && (
            <Button
              variant={muted ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => toggleMic()}
              aria-pressed={!muted}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              title={micError ?? (muted ? 'Unmute' : 'Mute')}
              className={cn(micError && 'border-destructive text-destructive')}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span className="hidden sm:inline">{muted ? 'Unmute' : 'Mute'}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => leave()} aria-label="Leave space">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Persistent, store-driven dock (model: PerfPanel). Mounted globally by the
 * orchestrator near <Toaster>; renders nothing unless a session is active.
 * Also mounts the expanded room overlay so it travels across routes.
 */
export const LiveSpaceBar: React.FC = () => {
  const session = useSpacesStore((s) => s.session);

  if (!SPACES_ENABLED) return null;
  if (!session) return null;

  return (
    <>
      <LiveSpaceBarBody session={session} />
      <SpaceRoomView />
    </>
  );
};
