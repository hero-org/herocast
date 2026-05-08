'use client';

/**
 * PreviewPane — right-side cast preview for the split-pane /feeds layout.
 *
 * Renders the full conversation thread (parent + cast + direct replies) for
 * the currently selected cast via `CastThreadView`. The same component the
 * `/conversation/[...slug]` route uses, so users see the same surface in
 * both places.
 *
 * Behavior:
 * - The thread is keyed on `cast.hash` so a new selection unmounts the
 *   previous thread (cancels its in-flight fetches via react-query unmount)
 *   and remounts cleanly with the new cast at the focused position.
 * - When `previewFocused` is true (the user pressed Tab / Shift+Right /
 *   clicked into the preview), the thread's internal `j`/`k` navigation
 *   activates so the user can move between the parent / cast / replies.
 *   When the list pane has focus instead, the thread's hotkeys are
 *   suppressed so feed-list `j`/`k` keeps moving cast selection.
 * - The cast subtree is wrapped in `PreviewEmbedContext` so descendant
 *   `EmbedList` instances swap the default carousel for the smart-group
 *   `MultiEmbedStack` renderer (matching `/conversation` and the rest of
 *   the embed-quality work).
 */

import { CastThreadView } from '@/common/components/CastThreadView';
import type { FarcasterCast } from '@/common/types/farcaster';
import { cn } from '@/lib/utils';
import { PreviewEmbedContext, type PreviewEmbedContextValue } from './PreviewEmbedContext';

type PreviewPaneProps = {
  /** The currently selected cast, or `null` when nothing is selected. */
  cast: FarcasterCast | null | undefined;
  /** Optional className for the outer container. */
  className?: string;
  /**
   * When true, the thread's internal `j`/`k` selection hotkeys activate.
   * Driven by the focus-region state in `feeds/page.tsx` so list-focused
   * keeps the feed `j`/`k`, preview-focused hands them to the thread.
   */
  previewFocused?: boolean;
};

// Stable context value — `inPreview` is a constant for this component, so
// hoisting the object out of render avoids forcing context consumers to
// re-evaluate on every PreviewPane render.
const PREVIEW_CONTEXT_VALUE: PreviewEmbedContextValue = { inPreview: true };

export function PreviewPane({ cast, className, previewFocused }: PreviewPaneProps) {
  return (
    <PreviewEmbedContext.Provider value={PREVIEW_CONTEXT_VALUE}>
      <div
        className={cn('h-full w-full', className)}
        role="region"
        aria-label="Cast preview"
        data-testid="preview-pane"
      >
        {cast ? (
          <CastThreadView key={cast.hash} cast={cast} containerHeight="100%" isActive={Boolean(previewFocused)} />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center px-6 py-12 text-sm text-muted-foreground"
            data-testid="preview-pane-empty"
          >
            Select a cast to preview it here.
          </div>
        )}
      </div>
    </PreviewEmbedContext.Provider>
  );
}
