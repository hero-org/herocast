'use client';

import { ChevronDown, LogOut, Mic, MicOff, Radio, Users } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import type { AudioRoomParticipant, SpaceSession } from '@/common/types/spaces';
import { canPublish, isHostRole } from '@/common/types/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useSpacesStore } from '@/stores/useSpacesStore';
import { formatListeners } from './LiveSpacesStrip';
import { SpaceParticipant, spaceUserInitials, spaceUserName, spaceUserPfp } from './SpaceParticipant';

const ROLE_LABEL: Record<string, string> = {
  host: 'Host',
  cohost: 'Co-host',
  speaker: 'Speaker',
  listener: 'Listener',
};

/** Number of listener avatars to show before collapsing into a "+N" tile. */
const MAX_LISTENER_AVATARS = 18;

function splitParticipants(participants: AudioRoomParticipant[]) {
  const speakers: AudioRoomParticipant[] = [];
  const listeners: AudioRoomParticipant[] = [];
  for (const p of participants) {
    if (canPublish(p.role)) speakers.push(p);
    else listeners.push(p);
  }
  return { speakers, listeners };
}

interface SpaceRoomViewBodyProps {
  session: SpaceSession;
}

const SpaceRoomViewBody: React.FC<SpaceRoomViewBodyProps> = ({ session }) => {
  const setExpanded = useSpacesStore((s) => s.setExpanded);
  const toggleMic = useSpacesStore((s) => s.toggleMic);
  const leave = useSpacesStore((s) => s.leave);
  const endSpace = useSpacesStore((s) => s.endSpace);
  const micError = useSpacesStore((s) => s.micError);

  const { room, role, participants, activeSpeakerFids, muted } = session;
  const activeSet = useMemo(() => new Set(activeSpeakerFids), [activeSpeakerFids]);
  const { speakers, listeners } = useMemo(() => splitParticipants(participants), [participants]);

  const userCanPublish = canPublish(role);
  const userIsHost = isHostRole(role);
  const visibleListeners = listeners.slice(0, MAX_LISTENER_AVATARS);
  const overflowCount = listeners.length - visibleListeners.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Collapse space"
          onClick={() => setExpanded(false)}
          className="-ml-2 shrink-0"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
              <Radio className="h-3 w-3" />
              Live
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {formatListeners(room.listenerCount ?? participants.length)}
            </span>
          </div>
          <h2 className="mt-1.5 truncate text-base font-semibold text-foreground">
            {room.title?.trim() || 'Untitled space'}
          </h2>
          <div className="mt-1 flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={spaceUserPfp(room.host)} alt={spaceUserName(room.host)} />
              <AvatarFallback className="text-[9px] font-medium">{spaceUserInitials(room.host)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">Hosted by {spaceUserName(room.host)}</span>
          </div>
        </div>
      </div>

      {/* Participant grid */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 py-5">
          {room.description?.trim() && (
            <p className="text-sm leading-relaxed text-muted-foreground">{room.description.trim()}</p>
          )}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Speakers</h3>
            {speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is speaking yet.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-2 gap-y-5">
                {speakers.map((p) => (
                  <SpaceParticipant
                    key={p.user.fid}
                    user={p.user}
                    size="lg"
                    canSpeak
                    isActiveSpeaker={activeSet.has(p.user.fid)}
                    roleLabel={ROLE_LABEL[p.role] ?? p.role}
                  />
                ))}
              </div>
            )}
          </section>

          {listeners.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Listeners ({listeners.length})
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-x-2 gap-y-4">
                {visibleListeners.map((p) => (
                  <SpaceParticipant key={p.user.fid} user={p.user} size="sm" />
                ))}
                {overflowCount > 0 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border">
                      +{overflowCount}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Footer controls */}
      <div className="border-t border-border px-5 py-4">
        {micError && userCanPublish && <p className="mb-2 text-xs text-destructive">{micError}</p>}
        <div className="flex items-center justify-between gap-2">
          {userCanPublish ? (
            <Button
              variant={muted ? 'outline' : 'secondary'}
              onClick={() => toggleMic()}
              aria-pressed={!muted}
              className="flex-1"
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {muted ? 'Unmute' : 'Mute'}
            </Button>
          ) : (
            <span className="flex-1 text-sm text-muted-foreground">You&apos;re listening</span>
          )}

          <Button variant="outline" onClick={() => leave()}>
            <LogOut className="h-4 w-4" />
            Leave
          </Button>

          {userIsHost && (
            <Button variant="destructive" onClick={() => endSpace()}>
              End
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The expanded room overlay. Rendered as a bottom Sheet driven by the store's
 * `expanded` flag; only mounted when a session exists.
 */
export const SpaceRoomView: React.FC = () => {
  const session = useSpacesStore((s) => s.session);
  const expanded = useSpacesStore((s) => s.expanded);
  const setExpanded = useSpacesStore((s) => s.setExpanded);

  if (!session) return null;

  return (
    <Sheet open={expanded} onOpenChange={setExpanded}>
      <SheetContent side="bottom" className={cn('h-[85vh] gap-0 rounded-t-2xl p-0')}>
        <SheetTitle className="sr-only">{session.room.title?.trim() || 'Live space'}</SheetTitle>
        <SheetDescription className="sr-only">Live audio space room with participants and controls.</SheetDescription>
        <SpaceRoomViewBody session={session} />
      </SheetContent>
    </Sheet>
  );
};
