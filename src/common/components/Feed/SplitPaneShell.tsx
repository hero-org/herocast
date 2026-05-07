'use client';

/**
 * SplitPaneShell — resizable two-pane layout for /feeds.
 *
 * Above Tailwind `lg` breakpoint (>= 1024px): renders a resizable Group with
 * the list on the left and the preview on the right. Default split is 40/60
 * (list/preview). The divider snaps to 30/70, 50/50, and 70/30 after the
 * user releases the drag.
 *
 * Below `lg`: collapses to single-column with only the list visible. The
 * preview pane is unmounted entirely so existing mobile tap-to-thread
 * behavior is preserved.
 *
 * Implementation notes:
 * - `'use client'` because react-resizable-panels v4 uses portals/IDs that
 *   are unsafe to render on the server.
 * - We use the v4 imperative API (`useGroupCallbackRef`) to apply snap
 *   layouts in `onLayoutChanged` (after the user releases the divider).
 * - Snap proximity is +/- 4 percentage points around each snap point.
 *   Tighter than 4 risks the user being unable to land on a non-snapped
 *   value; looser feels sticky.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Group, type Layout, Panel, Separator, useGroupCallbackRef } from 'react-resizable-panels';
import { useMediaQuery } from '@/common/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const LIST_PANEL_ID = 'feeds-list';
const PREVIEW_PANEL_ID = 'feeds-preview';

const DEFAULT_LIST_SIZE = 40;
const DEFAULT_PREVIEW_SIZE = 60;
const MIN_PANEL_SIZE = 25;

const SNAP_POINTS: ReadonlyArray<readonly [number, number]> = [
  [30, 70],
  [50, 50],
  [70, 30],
];
const SNAP_THRESHOLD = 4;

/** Tailwind `lg` breakpoint (1024px) per default Tailwind config. */
const LG_BREAKPOINT_QUERY = '(min-width: 1024px)';

type SplitPaneShellProps = {
  /** The scrollable list pane (left side). Always rendered. */
  list: ReactNode;
  /** The preview pane (right side). Only rendered above `lg` breakpoint. */
  preview: ReactNode;
  /** Optional className applied to the outer container. */
  className?: string;
  /**
   * When `true`, draws a subtle focus accent ring on the list pane. Mutually
   * exclusive with `previewFocused`. When neither is set the panes render
   * without focus chrome (initial mount / mobile).
   */
  listFocused?: boolean;
  /**
   * When `true`, draws a subtle focus accent ring on the preview pane.
   * Mutually exclusive with `listFocused`.
   */
  previewFocused?: boolean;
};

/**
 * Tailwind classes applied to the focused pane. Uses the same accent token as
 * selected-row chrome in `StandardCastRow.tsx` (`border-foreground/20`) so
 * focus indication feels native to the rest of the feed UI.
 */
const FOCUS_RING_CLASSES = 'ring-1 ring-inset ring-foreground/20';

/**
 * Snap the layout to the nearest defined snap point if the released layout is
 * within `SNAP_THRESHOLD` percentage points of one. Returns the snapped layout
 * or `null` if no snap should be applied.
 */
function getSnappedLayout(listSize: number): { list: number; preview: number } | null {
  for (const [snapList, snapPreview] of SNAP_POINTS) {
    if (Math.abs(listSize - snapList) <= SNAP_THRESHOLD) {
      return { list: snapList, preview: snapPreview };
    }
  }
  return null;
}

export function SplitPaneShell({
  list,
  preview,
  className,
  listFocused = false,
  previewFocused = false,
}: SplitPaneShellProps) {
  const isDesktop = useMediaQuery(LG_BREAKPOINT_QUERY, { defaultValue: false });
  const [groupHandle, groupRef] = useGroupCallbackRef();
  // Track whether we're mounted so we can avoid SSR / hydration mismatch on
  // the resizable portion. The list pane renders identically in both modes.
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleLayoutChanged = useCallback(
    (layout: Layout) => {
      if (!groupHandle) return;
      const listSize = layout[LIST_PANEL_ID];
      if (typeof listSize !== 'number') return;

      const snapped = getSnappedLayout(listSize);
      if (!snapped) return;
      // Avoid a redundant setLayout call when we're already at a snap point
      // (e.g. on initial mount with default 40/60, no snap matches; or after
      // a previous snap, the layout already matches exactly).
      if (snapped.list === listSize) return;

      groupHandle.setLayout({
        [LIST_PANEL_ID]: snapped.list,
        [PREVIEW_PANEL_ID]: snapped.preview,
      });
    },
    [groupHandle]
  );

  // Below the lg breakpoint OR before client mount: render only the list.
  // Mounting guard prevents a flash of two-pane on SSR if user is on mobile.
  if (!hasMounted || !isDesktop) {
    return (
      <div className={cn('h-full w-full', className)} data-testid="split-pane-shell-mobile">
        {list}
      </div>
    );
  }

  return (
    <Group
      groupRef={groupRef}
      orientation="horizontal"
      className={cn('flex h-full w-full', className)}
      onLayoutChanged={handleLayoutChanged}
      data-testid="split-pane-shell"
    >
      <Panel
        id={LIST_PANEL_ID}
        defaultSize={DEFAULT_LIST_SIZE}
        minSize={MIN_PANEL_SIZE}
        className={cn('h-full min-w-0 overflow-hidden', listFocused && FOCUS_RING_CLASSES)}
        data-testid="split-pane-list"
        data-focus-region={listFocused ? 'list' : undefined}
      >
        {list}
      </Panel>
      <Separator
        className="relative flex w-px items-center justify-center bg-border hover:bg-border/80 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        data-testid="split-pane-resize-handle"
      />
      <Panel
        id={PREVIEW_PANEL_ID}
        defaultSize={DEFAULT_PREVIEW_SIZE}
        minSize={MIN_PANEL_SIZE}
        className={cn('h-full min-w-0 overflow-hidden', previewFocused && FOCUS_RING_CLASSES)}
        data-testid="split-pane-preview"
        data-focus-region={previewFocused ? 'preview' : undefined}
      >
        {preview}
      </Panel>
    </Group>
  );
}
