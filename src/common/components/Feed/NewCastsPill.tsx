'use client';

/**
 * NewCastsPill — "N new casts" pill that surfaces queued upstream items.
 *
 * Purely presentational. The parent (`app/(app)/feeds/page.tsx`) owns:
 *   - detecting that new casts have arrived above the user's current scroll
 *     position,
 *   - tracking the queued count,
 *   - clearing the queue and scrolling to the top when the user activates the
 *     pill (via the `onClick` prop).
 *
 * This component renders a centered button at the top of its parent (which
 * must establish a positioning context with `position: relative`). It returns
 * `null` when `count <= 0`, so visibility is driven entirely by the parent's
 * count value — there is no internal show/hide state.
 */

import { ChevronUpIcon } from '@heroicons/react/20/solid';
import { cn } from '@/lib/utils';

type NewCastsPillProps = {
  /** Number of new casts queued above the current view. */
  count: number;
  /** Fires when the user activates the pill (parent should clear + scroll). */
  onClick: () => void;
  /** Optional className applied to the button. */
  className?: string;
};

export function NewCastsPill({ count, onClick, className }: NewCastsPillProps) {
  const hasCasts = count > 0;
  const label = hasCasts ? `${count} new ${count === 1 ? 'cast' : 'casts'}` : '';
  const ariaLabel = `Load ${count} new ${count === 1 ? 'cast' : 'casts'} and scroll to top`;

  return (
    <>
      {/* Always-mounted screen-reader live region. Its content changes when
          new casts arrive, which screen readers announce automatically. The
          visible button below is rendered conditionally and may not exist
          when the user scrolls back to the top — the live region keeps the
          announcement working in both states. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {label}
      </div>
      {hasCasts && (
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          data-testid="new-casts-pill"
          className={cn(
            'absolute top-2 left-1/2 z-10 -translate-x-1/2',
            'inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background shadow',
            'hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/50 transition-colors',
            className
          )}
        >
          <span>{label}</span>
          <ChevronUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
