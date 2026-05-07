'use client';

/**
 * PreviewPane — right-side cast preview for the split-pane /feeds layout.
 *
 * Renders the currently selected cast at full size using the existing
 * `<CastRow isEmbed={false} />` (Phase 1 Week 1 deliberately ships without
 * any new embed-rendering work — that lands in Week 2).
 *
 * Behavior:
 * - Resets the scroll container to the top whenever the selected cast
 *   changes. This matches the spec ("Preview scroll resets to top on every
 *   selection change") and is necessary because the underlying CastRow may
 *   not change height between selections.
 * - Provides an `AbortController` per selection. While today's CastRow /
 *   embed renderers do not consume an AbortSignal, the controller is aborted
 *   on selection change so that a future Week 2 embed-fetch coordinator can
 *   plug in via the exposed signal. Re-mounting via the `key={cast.hash}`
 *   chrome wrapper also unmounts current effects, which is the strongest
 *   "cancel" available without modifying CastRow / Embeds.
 * - The chrome wrapper is `React.memo`'d and keyed on the cast hash so
 *   identical selections do not re-render the wrapper, while distinct
 *   selections force a clean re-mount of the cast subtree.
 */

import { memo, useEffect, useRef } from 'react';
import { CastRow } from '@/common/components/CastRow';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';

type PreviewPaneProps = {
  /** The currently selected cast, or `null` when nothing is selected. */
  cast: FarcasterCast | null | undefined;
  /** Whether to show the channel pill (mirrors feeds page logic). */
  showChannel?: boolean;
  /** Optional className for the outer scroll container. */
  className?: string;
};

/**
 * Memoized chrome wrapper for the preview cast. Keyed on cast hash so
 * unchanged selections skip work, but new selections re-mount the cast
 * subtree (which cancels any in-flight effects in CastRow / Embeds).
 */
const PreviewChrome = memo(function PreviewChrome({
  cast,
  showChannel,
}: {
  cast: FarcasterCast;
  showChannel?: boolean;
}) {
  return (
    <div className="border-b border-border w-full pr-4">
      <CastRow cast={cast} isEmbed={false} isSelected={false} showChannel={showChannel} />
    </div>
  );
});

function PreviewPaneImpl({ cast, showChannel, className }: PreviewPaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const castHash = cast?.hash;

  // On selection change: abort the previous in-flight controller, mint a new
  // one for the upcoming selection, and reset preview scroll to top.
  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [castHash]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn('h-full w-full overflow-y-auto no-scrollbar', className)}
      role="region"
      aria-label="Cast preview"
      data-testid="preview-pane"
    >
      {cast ? (
        <PreviewChrome key={cast.hash} cast={cast} showChannel={showChannel} />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center px-6 py-12 text-sm text-muted-foreground"
          data-testid="preview-pane-empty"
        >
          Select a cast to preview it here.
        </div>
      )}
    </div>
  );
}

export const PreviewPane = memo(PreviewPaneImpl);
