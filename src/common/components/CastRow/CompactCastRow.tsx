import { HeartIcon } from '@heroicons/react/24/outline';
import React, { useCallback } from 'react';
import { useChannelLookup } from '@/common/hooks/useChannelLookup';
import type { FarcasterCast } from '@/common/types/farcaster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CastTime } from './CastTime';

/**
 * Two-character initials for the avatar fallback. Prefers display_name
 * (taking the first letter of each of the first two words), falls back to
 * the first two chars of username, then '?'.
 */
function avatarInitials(displayName: string, username: string): string {
  const trimmed = displayName.trim();
  if (trimmed) {
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (username) return username.slice(0, 2).toUpperCase();
  return '?';
}

/**
 * CompactCastRow — dense list-pane row for the split-pane /feeds layout.
 *
 * Visual hierarchy (top to bottom):
 *   [Avatar 32px]  Author Name  @handle              ← line 1: identity (muted, small)
 *                  Cast text                         ← line 2-3: content (loudest, up to 2 lines)
 *                  2h · /channel · ♥ 47              ← meta row: muted, likes only when >0
 *
 * Cast text is the loudest element (text-base font-medium) and clamps to 2
 * lines to give enough preview for scanning without clicking each cast.
 * Identity sits above the text but smaller and quieter so the eye lands on
 * content first. Like count appears in the meta row only when > 0 so the
 * user can see at a glance which casts are resonating.
 *
 * Constraints (Phase 1 Week 1, Lane 1E):
 * - No embed icons in the meta row (embed presence is surfaced in the preview pane).
 * - No reaction-action affordances (the row is non-interactive beyond click-to-select).
 * - No `read more` affordance — text is always 2-line clamped in the list.
 * - Selection styling matches `StandardCastRow` (`bg-muted` + 1px left border accent).
 * - Hover: subtle bg tint, no border change.
 * - The component does NOT bind any hotkeys — j/k/o/Shift+O live on the parent
 *   `SelectableListWithHotkeys`, which fires `onSelect` for the active row.
 *
 * Design choices documented for the integrator:
 * - `Author` / `AuthorHeader` primitives were considered for reuse but are too
 *   heavy for a compact row (admin dropdown, conversation deep-link, channel
 *   pill). We compose the identity row inline using shadcn `Avatar`.
 * - `CastText` was considered for the content line but adds a `useAppHotkeys`
 *   registration per row plus a `read more` button on truncation overflow,
 *   neither of which belongs in a compact list view. We render plain text with
 *   Tailwind `line-clamp-2` instead. Mentions / links stay non-interactive in
 *   the list — users open the preview pane to interact.
 * - `CastTime` is reused as-is because its `2h` / `15m` output matches the spec.
 * - `idx` travels through props rather than being captured in a closure so the
 *   parent's `onSelect` callback stays stable across re-renders, allowing the
 *   `React.memo` equality check to skip work during fast j/k flow.
 *
 * Avatar sizing: `h-8 w-8` is the established 32px pattern in the codebase
 * (see `ProfileInfoContent.tsx`, comments lists, DM lists).
 */

export interface CompactCastRowProps {
  cast: FarcasterCast;
  /** Index in the parent feed list. Passed back to onSelect on click. */
  idx: number;
  isSelected?: boolean;
  /** Whether to surface the channel name in the meta row (channel feeds only). */
  showChannel?: boolean;
  /** Fires on row click with the row's idx. Parent gates desktop preview vs mobile thread-view. */
  onSelect?: (idx: number) => void;
}

const CompactCastRowComponent: React.FC<CompactCastRowProps> = ({ cast, idx, isSelected, showChannel, onSelect }) => {
  // Mirror StandardCastRow's channel resolution path so the meta row label
  // matches the channel pill in the preview pane.
  const parentUrl = cast.parent_url ?? null;
  const { channel: parentChannel } = useChannelLookup(parentUrl ?? undefined);
  const channelName = showChannel && parentChannel?.name ? parentChannel.name : null;

  const username = cast.author?.username ?? '';
  const displayName = cast.author?.display_name || username;
  const pfpUrl = cast.author?.pfp_url;
  const likesCount = cast.reactions?.likes_count ?? 0;

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Stop propagation so a parent click handler (e.g. virtualizer wrapper)
      // doesn't double-fire selection.
      event.stopPropagation();
      onSelect?.(idx);
    },
    [onSelect, idx]
  );

  return (
    <div
      className={cn(
        'flex items-start gap-x-3 px-3 py-2 cursor-pointer transition-colors',
        // Selected-row treatment matches StandardCastRow:
        //   bg-muted + 1px left border accent.
        // Hover is a softer muted/50 to avoid fighting with selected styling.
        isSelected ? 'bg-muted border-l border-foreground/20' : 'border-l border-transparent hover:bg-muted/50'
      )}
      onClick={handleClick}
      data-testid="compact-cast-row"
      data-selected={isSelected ? 'true' : undefined}
    >
      <Avatar className="relative h-8 w-8 shrink-0">
        <AvatarImage src={pfpUrl} alt={username} />
        <AvatarFallback>{avatarInitials(displayName, username)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col min-w-0 flex-1 gap-y-0.5">
        {/* Line 1 — identity (muted, smaller than cast text) */}
        <div className="flex items-center gap-x-1.5 text-xs leading-4 text-foreground/50 min-w-0">
          <span className="font-medium text-foreground/70 truncate">{displayName}</span>
          {username && <span className="truncate">@{username}</span>}
        </div>

        {/* Line 2 — cast content (loudest element). 2 lines so users get
            enough preview to scan without clicking each cast. */}
        <div className="text-base font-medium leading-snug text-foreground line-clamp-2 break-words" title={cast.text}>
          {cast.text}
        </div>

        {/* Meta row — muted timestamp · optional channel · likes (when > 0) */}
        <div className="flex items-center gap-x-1.5 text-xs leading-4 text-foreground/50 min-w-0">
          <CastTime timestamp={cast.timestamp} />
          {channelName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">/{channelName}</span>
            </>
          )}
          {likesCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-x-0.5 shrink-0" title={`${likesCount} likes`}>
                <HeartIcon className="h-3 w-3" aria-hidden="true" />
                <span>{likesCount}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const CompactCastRow = React.memo(CompactCastRowComponent, (prev, next) => {
  // Compact rows render a tiny subset of cast data — only re-render when the
  // visually load-bearing fields change. Embeds are irrelevant here. Likes
  // count is included so the meta-row count updates as reactions arrive.
  // `onSelect` is a stable callback from the parent (idx travels via prop)
  // so we deliberately omit it from the equality check.
  return (
    prev.idx === next.idx &&
    prev.cast.hash === next.cast.hash &&
    prev.cast.text === next.cast.text &&
    prev.cast.timestamp === next.cast.timestamp &&
    prev.cast.parent_url === next.cast.parent_url &&
    prev.cast.author?.pfp_url === next.cast.author?.pfp_url &&
    prev.cast.author?.username === next.cast.author?.username &&
    prev.cast.author?.display_name === next.cast.author?.display_name &&
    (prev.cast.reactions?.likes_count ?? 0) === (next.cast.reactions?.likes_count ?? 0) &&
    prev.isSelected === next.isSelected &&
    prev.showChannel === next.showChannel
  );
});
