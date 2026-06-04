'use client';

/**
 * SidebarFeedRow — a single selectable feed row in the left-sidebar "feeds
 * disclosure" (Direction 01 "Disclosure"). Pure presentation: props in, JSX
 * out. Ported from the approved `lab/` Disclosure variant (`Row` + `FeedRow` +
 * `FeedGlyph` + `SidebarKbd`) onto the real `--sidebar-*` design tokens.
 */

import { Hash } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import type { SidebarFeed } from './types';

/** Map a canonical key name to its display glyph (e.g. `shift` → `⇧`). */
function keyGlyph(key: string): string {
  const map: Record<string, string> = { shift: '⇧', meta: '⌘', ctrl: '⌃' };
  return map[key.toLowerCase()] ?? key.toUpperCase();
}

/** Small keyboard hint, dimmed until row hover / selection (matches real nav). */
function SidebarKbd({ shortcut, active }: { shortcut: string; active?: boolean }) {
  return (
    <Kbd
      className={cn(
        'h-4 min-w-4 bg-sidebar-accent/60 text-[10px] text-sidebar-foreground/60 transition-opacity',
        active ? 'opacity-70' : 'opacity-0 group-hover:opacity-60'
      )}
    >
      {shortcut.includes('+')
        ? shortcut
            .split('+')
            .map((k) => keyGlyph(k))
            .join('')
        : keyGlyph(shortcut)}
    </Kbd>
  );
}

/** Leading glyph for a feed, by kind (channel avatar / violet # / lucide icon). */
function FeedGlyph({ feed }: { feed: SidebarFeed }) {
  if (feed.kind === 'channel') {
    if (feed.iconUrl) {
      return (
        <img
          src={feed.iconUrl}
          alt=""
          className="h-5 w-5 flex-none rounded-md border border-sidebar-border/50 object-cover"
        />
      );
    }
    // Violet # chip (design rule #4: channels are violet).
    return (
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-channel/10 text-channel">
        <Hash className="h-3 w-3" />
      </span>
    );
  }

  const Icon = feed.icon ?? Hash;
  return (
    <span className="flex h-5 w-5 flex-none items-center justify-center text-sidebar-foreground/60">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function SidebarFeedRow({
  feed,
  isSelected,
  onSelect,
}: {
  feed: SidebarFeed;
  isSelected: boolean;
  onSelect: (feed: SidebarFeed) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(feed)}
      title={feed.name}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-x-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
      )}
    >
      {isSelected && (
        <span
          className={cn(
            'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full',
            feed.kind === 'channel' ? 'bg-channel' : 'bg-sidebar-primary'
          )}
        />
      )}
      <span className="flex-none">
        <FeedGlyph feed={feed} />
      </span>
      <span className={cn('flex-1 truncate', isSelected && 'font-semibold')}>{feed.name}</span>
      {feed.kbd && (
        <span className="ml-auto flex flex-none items-center gap-x-1.5">
          <SidebarKbd shortcut={feed.kbd} active={isSelected} />
        </span>
      )}
    </button>
  );
}
