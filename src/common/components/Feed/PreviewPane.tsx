'use client';

/**
 * PreviewPane — right-side cast preview for the split-pane /feeds layout.
 *
 * Renders the currently selected cast at full size using the existing
 * `<CastRow isEmbed={false} />`. The cast subtree is wrapped in
 * `PreviewEmbedContext` so descendants can:
 *   - swap the default `EmbedCarousel` for the smart-group `MultiEmbedStack`
 *     renderer (see `CastRow/EmbedSection.tsx`).
 *   - read an `AbortSignal` for per-selection embed fetches.
 *
 * Behavior:
 * - Resets the scroll container to the top whenever the selected cast
 *   changes. Matches the spec ("Preview scroll resets to top on every
 *   selection change") and is necessary because the underlying CastRow may
 *   not change height between selections.
 * - Aborts the previous selection's controller before minting a new one and
 *   exposes the signal via context. The `key={cast.hash}` re-mount also
 *   unmounts effects of the previous cast — context + remount together cover
 *   both react-query queries (auto-aborted on unmount) and any manual
 *   `fetch()` callers that opt into the signal.
 * - The chrome wrapper is `React.memo`'d and keyed on the cast hash so
 *   identical selections do not re-render the wrapper, while distinct
 *   selections force a clean re-mount of the cast subtree.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CastRow } from '@/common/components/CastRow';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';
import { PreviewEmbedContext } from './PreviewEmbedContext';

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
  const castHash = cast?.hash;

  // Lazy-init so the controller exists at first render — context consumers
  // that read `abortSignal` synchronously get a real signal on the very first
  // paint. Replaced (not just aborted) on every *subsequent* selection change
  // so React's identity comparison forces a fresh memoized context value.
  const [controller, setController] = useState<AbortController>(() => new AbortController());
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    // First effect for the initial cast: keep the lazy-init controller intact
    // so any fetch started during the first render keeps its valid signal.
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
    } else {
      setController((prev) => {
        prev.abort();
        return new AbortController();
      });
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [castHash]);

  // Abort the current (post-state-update) controller on unmount. Re-running
  // on `controller` change keeps the closure pointing at the live one; the
  // intermediate cleanup invocations during a swap are harmless because
  // `setController`'s updater already aborts the prior controller.
  useEffect(() => {
    return () => {
      controller.abort();
    };
  }, [controller]);

  const contextValue = useMemo(
    () => ({
      inPreview: true,
      abortSignal: controller.signal,
    }),
    [controller]
  );

  return (
    <div
      ref={scrollContainerRef}
      className={cn('h-full w-full overflow-y-auto no-scrollbar', className)}
      role="region"
      aria-label="Cast preview"
      data-testid="preview-pane"
    >
      <PreviewEmbedContext.Provider value={contextValue}>
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
      </PreviewEmbedContext.Provider>
    </div>
  );
}

export const PreviewPane = memo(PreviewPaneImpl);
