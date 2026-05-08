'use client';

/**
 * PreviewPane — right-side cast preview for the split-pane /feeds layout.
 *
 * Renders the currently selected cast at full size using the existing
 * `<CastRow isEmbed={false} />`. The cast subtree is wrapped in
 * `PreviewEmbedContext` so `EmbedList` (in `CastRow/EmbedSection.tsx`)
 * swaps the default `EmbedCarousel` for the smart-group `MultiEmbedStack`
 * renderer.
 *
 * Behavior:
 * - Resets the scroll container to the top whenever the selected cast
 *   changes. Matches the spec ("Preview scroll resets to top on every
 *   selection change") and is necessary because the underlying CastRow may
 *   not change height between selections.
 * - The chrome wrapper is `React.memo`'d and keyed on the cast hash so
 *   identical selections do not re-render the wrapper, while distinct
 *   selections force a clean re-mount of the cast subtree. The remount is
 *   what cancels in-flight embed fetches (react-query auto-aborts on unmount).
 */

import { memo, useEffect, useRef } from 'react';
import { CastRow } from '@/common/components/CastRow';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';
import { PreviewEmbedContext, type PreviewEmbedContextValue } from './PreviewEmbedContext';

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
 *
 * `isSelected` is true here even though the visual selection lives on the
 * compact list row — it activates the `CAST_SELECTED` hotkey scope inside
 * the underlying `ReactionBar` so `l` (like) and `Shift+R` (recast) fire
 * against the cast the user is actually looking at.
 *
 * `defaultExpanded` initializes the cast text expanded so the preview never
 * starts truncated — when the user is in the preview pane they want the
 * full text immediately, not a `read more...` they need to press `x` for.
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
      <CastRow cast={cast} isEmbed={false} isSelected={true} defaultExpanded={true} showChannel={showChannel} />
    </div>
  );
});

// Stable context value — `inPreview` is a constant for this component, so
// hoisting the object out of render avoids forcing context consumers to
// re-evaluate on every PreviewPane render.
const PREVIEW_CONTEXT_VALUE: PreviewEmbedContextValue = { inPreview: true };

function PreviewPaneImpl({ cast, showChannel, className }: PreviewPaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const castHash = cast?.hash;

  // Reset preview scroll to the top on every selection change so the user
  // never lands mid-scroll on a different cast. The `key={cast.hash}`
  // remount below handles cancellation of any in-flight embed fetches by
  // unmounting the previous cast's react-query subscriptions.
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [castHash]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn('h-full w-full overflow-y-auto no-scrollbar', className)}
      role="region"
      aria-label="Cast preview"
      data-testid="preview-pane"
    >
      <PreviewEmbedContext.Provider value={PREVIEW_CONTEXT_VALUE}>
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
