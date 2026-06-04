'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarClock, Radio, Users } from 'lucide-react';
import Head from 'next/head';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CreateSpaceDialog } from '@/common/components/Spaces/CreateSpaceDialog';
import { LiveSpacesStrip } from '@/common/components/Spaces/LiveSpacesStrip';
import { SPACE_DISCOVERY_LIMIT, SPACES_ENABLED } from '@/common/constants/spaces';
import type { AudioRoom } from '@/common/types/spaces';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useSpacesStore } from '@/stores/useSpacesStore';

/** Re-fetch discovery on this cadence while the tab is visible. */
const DISCOVERY_REFRESH_MS = 10_000;

function formatScheduledTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = parseISO(iso);
  if (!isValid(date)) return null;
  return format(date, "EEE, MMM d 'at' h:mm a");
}

interface ScheduledRowProps {
  room: AudioRoom;
}

const ScheduledRow: React.FC<ScheduledRowProps> = ({ room }) => {
  const when = formatScheduledTime(room.scheduledAt);
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{room.title?.trim() || 'Untitled space'}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarImage src={room.host?.pfp?.url || room.host?.pfpUrl} alt={room.host?.username ?? ''} />
            <AvatarFallback className="text-[8px]">{(room.host?.username ?? '??').slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{room.host?.displayName || room.host?.username || `fid:${room.host?.fid}`}</span>
          {when && <span className="shrink-0">· {when}</span>}
        </div>
      </div>
    </Card>
  );
};

export default function SpacesPage() {
  const discovery = useSpacesStore((s) => s.discovery);
  const refreshDiscovery = useSpacesStore((s) => s.refreshDiscovery);
  const join = useSpacesStore((s) => s.join);
  const session = useSpacesStore((s) => s.session);
  const [createOpen, setCreateOpen] = useState(false);

  // Refresh on mount + light interval while the tab is visible.
  useEffect(() => {
    refreshDiscovery();

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') refreshDiscovery();
      }, DISCOVERY_REFRESH_MS);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDiscovery();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshDiscovery]);

  const { live, scheduled, loading, lastFetch } = discovery;
  const hasFetched = lastFetch != null && lastFetch > 0;
  const isInitialLoading = loading && !hasFetched;
  const isEmpty = hasFetched && live.length === 0 && scheduled.length === 0;

  const handleJoin = (roomId: string) => {
    if (session?.room.id === roomId) {
      // Already in this room — just re-open the expanded view.
      useSpacesStore.getState().setExpanded(true);
      return;
    }
    join(roomId);
  };

  return (
    <>
      <Head>
        <title>Spaces - herocast</title>
      </Head>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Radio className="h-6 w-6 text-destructive" />
                Spaces
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Live audio rooms on Farcaster. Drop in to listen, or go live yourself.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              Start a space
            </Button>
          </div>

          {!SPACES_ENABLED ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Spaces are not enabled in this environment.</p>
            </Card>
          ) : isInitialLoading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Spinner size="lg" />
              <span className="text-sm text-muted-foreground">Finding live spaces…</span>
            </div>
          ) : isEmpty ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Radio className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">No live spaces right now</p>
                <p className="mt-1 text-sm text-muted-foreground">Be the first — start one and bring people in.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                Start a space
              </Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Live rooms */}
              {live.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live now</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                      <Users className="h-3 w-3" />
                      {live.length}
                    </span>
                  </div>
                  <LiveSpacesStrip rooms={live.slice(0, SPACE_DISCOVERY_LIMIT)} onJoin={handleJoin} />
                </section>
              )}

              {/* Scheduled rooms */}
              {scheduled.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Scheduled
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {scheduled.slice(0, SPACE_DISCOVERY_LIMIT).map((room) => (
                      <ScheduledRow key={room.id} room={room} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
