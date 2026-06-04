'use client';

/**
 * SidebarFeedList — renders a flat list of `SidebarFeedRow`s for one group
 * (custom feeds, channels, or lists). When the list is longer than
 * `initialVisibleCount`, it collapses the tail behind a "Show N more" toggle,
 * mirroring the approved `lab/` Disclosure variant. Pure presentation.
 */

import { useState } from 'react';
import { SidebarFeedRow } from './SidebarFeedRow';
import type { SidebarFeed } from './types';

export function SidebarFeedList({
  feeds,
  selectedId,
  onSelect,
  initialVisibleCount = 7,
}: {
  feeds: SidebarFeed[];
  selectedId: string | null;
  onSelect: (feed: SidebarFeed) => void;
  initialVisibleCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  if (feeds.length === 0) return null;

  const canCollapse = feeds.length > initialVisibleCount;
  const collapsed = canCollapse && !showAll;
  const visibleFeeds = collapsed ? feeds.slice(0, initialVisibleCount) : feeds;

  // Keep the active feed visible even when it lives in the collapsed tail, so
  // "where am I?" never disappears behind "Show more".
  const selectedInTail =
    collapsed && selectedId != null
      ? feeds.slice(initialVisibleCount).find((feed) => feed.id === selectedId)
      : undefined;
  const moreCount = feeds.length - initialVisibleCount - (selectedInTail ? 1 : 0);

  return (
    <>
      {visibleFeeds.map((feed) => (
        <SidebarFeedRow key={feed.id} feed={feed} isSelected={feed.id === selectedId} onSelect={onSelect} />
      ))}
      {selectedInTail && (
        <SidebarFeedRow key={selectedInTail.id} feed={selectedInTail} isSelected onSelect={onSelect} />
      )}
      {canCollapse && (showAll || moreCount > 0) && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="px-2 py-1 text-left text-xs font-medium text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground"
        >
          {showAll ? 'Show less' : `Show ${moreCount} more`}
        </button>
      )}
    </>
  );
}
