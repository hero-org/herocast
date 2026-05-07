'use client';

/**
 * MultiEmbedStack — preview-pane embed renderer.
 *
 * Replaces `EmbedCarousel` for the /feeds preview surface (carousel UX is
 * explicitly out of scope per the plan). The strategy:
 *
 * 1. Filter embeds the same way `EmbedList` does (drop Zapper transactions,
 *    drop entries with no usable identifier).
 * 2. Pull every image-URL embed out into a single gallery group rendered as
 *    a 1×N or 2×2 grid. The original embed order is preserved for the
 *    remaining (non-image) embeds.
 * 3. Render each remaining embed in its own slot, stacked vertically. Each
 *    slot reserves an aspect ratio appropriate to the embed type so the
 *    OG-metadata fetch completing later doesn't push everything below it
 *    around the page.
 * 4. Frame v2 / mini app embeds (matched against `cast.frames` with
 *    `version === 'next'`) render interactively via `FrameV2Embed`. Anything
 *    else falls through to the existing `renderEmbedForUrl` dispatcher.
 */

import { ErrorBoundary } from '@sentry/react';
import type React from 'react';
import { useMemo } from 'react';
import { openWindow } from '@/common/helpers/navigation';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';
import { renderEmbedForUrl } from '../Embeds';
import { FrameV2Embed } from './FrameV2Embed';
import { groupEmbeds, type SlotGroup, type SlotKind } from './groupEmbeds';

export type { EmbedGroup, SlotGroup, SlotKind } from './groupEmbeds';
export { groupEmbeds } from './groupEmbeds';

/**
 * Picks the Tailwind aspect-ratio class for the gallery wrapper based on
 * how many images we have. Each shape was chosen so the box reserves a
 * sensible footprint before any image bytes load.
 */
const galleryShape = (count: number): { container: string; cellAspect?: string } => {
  if (count <= 1) return { container: 'aspect-[4/3]' };
  if (count === 2) return { container: 'aspect-[2/1]' };
  if (count === 3) return { container: 'aspect-[3/1]' };
  // 4+ images → 2×2 with a "+N" overlay if more
  return { container: 'aspect-square', cellAspect: 'aspect-square' };
};

const ImageGallery = ({ urls }: { urls: string[] }) => {
  const visible = urls.slice(0, 4);
  const overflow = urls.length - visible.length;
  const shape = galleryShape(visible.length);

  if (visible.length === 1) {
    return (
      <button
        type="button"
        className={cn(
          'relative block w-full max-w-lg overflow-hidden rounded-lg border border-muted bg-muted/40',
          shape.container
        )}
        onClick={(e) => {
          e.stopPropagation();
          openWindow(visible[0]);
        }}
      >
        <img
          src={visible[0]}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </button>
    );
  }

  const gridCols = visible.length === 2 ? 'grid-cols-2' : visible.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  const gridRows = visible.length === 4 ? 'grid-rows-2' : 'grid-rows-1';

  return (
    <div
      className={cn(
        'grid w-full max-w-lg gap-1 overflow-hidden rounded-lg border border-muted bg-muted/40',
        shape.container,
        gridCols,
        gridRows
      )}
    >
      {visible.map((url, idx) => {
        const showOverflow = overflow > 0 && idx === visible.length - 1;
        return (
          <button
            type="button"
            key={`${url}-${idx}`}
            className="relative block h-full w-full overflow-hidden bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              openWindow(url);
            }}
          >
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            {showOverflow && (
              <div className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-2xl font-semibold text-background">
                +{overflow}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Wraps a non-image embed in a sized container that reserves space, gates
 * click-through to a new tab for URL types, and hands over to the legacy
 * `renderEmbedForUrl` dispatcher for the actual content.
 */
const EmbedSlot = ({ group, hideReactions }: { group: SlotGroup; hideReactions: boolean }) => {
  const { slotKind, embed, frame } = group;

  if (slotKind === 'frame-v2' && embed.url) {
    return <FrameV2Embed url={embed.url} title={frame?.title} splashImageUrl={frame?.image} />;
  }

  // Per-slot reservation — keeps the column from jumping when async metadata
  // arrives. `min-h-*` lets the embed grow if its own content is taller.
  // No reservation for `frame-v2` because that branch returned early above.
  const reservation: Record<Exclude<SlotKind, 'frame-v2'>, string> = {
    video: 'min-h-[200px]',
    cast: 'min-h-[120px]',
    tweet: 'min-h-[180px]',
    url: 'min-h-[64px]',
  };

  // Only the URL slot routes click → openWindow. Video has its own
  // controls, cast quotes route to the thread via inner CastRow, tweet
  // has its own intra-component links — wrapping any of those in an
  // openWindow click hijacks scrubber / pause / link interactions.
  const isClickToOpen = slotKind === 'url';
  const handleClick = (event: React.MouseEvent) => {
    if (!isClickToOpen || !embed.url) return;
    event.stopPropagation();
    openWindow(embed.url);
  };

  return (
    <ErrorBoundary fallback={<UrlFallback url={embed.url} />}>
      <div
        className={cn(
          'w-full max-w-lg',
          reservation[slotKind as Exclude<SlotKind, 'frame-v2'>],
          isClickToOpen && 'cursor-pointer'
        )}
        onClick={handleClick}
      >
        {renderEmbedForUrl({
          url: embed.url,
          cast_id: embed.cast_id,
          hideReactions,
          skipIntersection: true,
        })}
      </div>
    </ErrorBoundary>
  );
};

const UrlFallback = ({ url }: { url?: string }) => {
  if (!url) return null;
  return (
    <button
      type="button"
      className="block w-full max-w-lg truncate rounded-lg border border-muted bg-muted/40 px-3 py-2 text-left text-sm text-foreground/80 hover:bg-muted/60"
      onClick={(e) => {
        e.stopPropagation();
        openWindow(url);
      }}
    >
      {url}
    </button>
  );
};

type MultiEmbedStackProps = {
  cast: FarcasterCast;
  hideReactions?: boolean;
  className?: string;
};

export const MultiEmbedStack: React.FC<MultiEmbedStackProps> = ({ cast, hideReactions = false, className }) => {
  const groups = useMemo(() => groupEmbeds(cast.embeds ?? [], cast.frames), [cast.embeds, cast.frames]);

  if (groups.length === 0) return null;

  return (
    <ErrorBoundary>
      <div className={cn('flex w-full flex-col gap-3', className)}>
        {groups.map((group, idx) => {
          if (group.kind === 'image-gallery') {
            return <ImageGallery key="image-gallery" urls={group.urls} />;
          }
          const embedKey = group.embed.url ?? group.embed.cast_id?.hash ?? `embed-${idx}`;
          return <EmbedSlot key={`${group.slotKind}-${embedKey}`} group={group} hideReactions={hideReactions} />;
        })}
      </div>
    </ErrorBoundary>
  );
};

export default MultiEmbedStack;
