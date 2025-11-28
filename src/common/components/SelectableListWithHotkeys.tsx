import React, { useLayoutEffect, useRef } from 'react';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { Key } from 'ts-key-enum';
import isEmpty from 'lodash.isempty';
import { HotkeyScopes, HotkeyScope } from '@/common/constants/hotkeys';
import { useRouter } from 'next/router';
import { getScopesForPage } from '@/common/constants/hotkeys';
import { useVirtualizer } from '@tanstack/react-virtual';

type SelectableListWithHotkeysProps = {
  data: any[];
  renderRow: (item: any, idx: number) => React.ReactNode;
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  onSelect?: (idx: number) => void;
  disableScroll?: boolean;
  onExpand?: (idx: number) => void;
  isActive?: boolean;
  onDown?: () => void;
  onUp?: () => void;
  // New optional props for pinned navigation
  pinnedNavigation?: boolean;
  containerHeight?: string;
  // Optional scopes for explicit scope injection
  scopes?: HotkeyScope[];
  // Optional footer to render inside scroll container
  footer?: React.ReactNode;
  // Estimated item height for virtualization (defaults to 150px for cast rows)
  estimatedItemHeight?: number;
};

export const SelectableListWithHotkeys = ({
  data,
  renderRow,
  selectedIdx,
  setSelectedIdx,
  onSelect,
  onExpand,
  disableScroll,
  onDown,
  onUp,
  isActive = true,
  // Default to false for backward compatibility
  pinnedNavigation = false,
  containerHeight = '80vh',
  scopes,
  footer,
  estimatedItemHeight = 150,
}: SelectableListWithHotkeysProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pageScopes = scopes ?? getScopesForPage(router.pathname);

  // Set up virtualizer for efficient rendering of large lists
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5, // Render 5 items above and below the visible area for smooth scrolling
  });

  // Scroll to selected item when selectedIdx changes
  useLayoutEffect(() => {
    if (!disableScroll && selectedIdx >= 0 && selectedIdx < data.length) {
      virtualizer.scrollToIndex(selectedIdx, {
        align: 'start',
        behavior: 'auto',
      });
    }
  }, [selectedIdx, disableScroll, data.length, virtualizer]);

  // Navigation hotkeys
  useAppHotkeys(
    ['j', Key.ArrowDown],
    () => {
      onDown?.();
      if (selectedIdx < data.length - 1) {
        setSelectedIdx(selectedIdx + 1);
      }
    },
    {
      scopes: pageScopes,
      enabled: isActive && !isEmpty(data),
    },
    [data, selectedIdx, setSelectedIdx, onDown]
  );

  useAppHotkeys(
    ['k', Key.ArrowUp],
    () => {
      onUp?.();
      if (selectedIdx === 0) {
        return;
      }
      setSelectedIdx(selectedIdx - 1);
    },
    {
      scopes: pageScopes,
      enabled: isActive && !isEmpty(data),
    },
    [data, selectedIdx, setSelectedIdx, onUp]
  );

  useAppHotkeys(
    ['o', Key.Enter],
    () => {
      onSelect?.(selectedIdx);
    },
    {
      scopes: pageScopes,
      enabled: isActive,
    },
    [selectedIdx, onSelect]
  );

  useAppHotkeys(
    'shift+o',
    () => {
      onExpand && onExpand(selectedIdx);
    },
    {
      scopes: pageScopes,
      enabled: onExpand !== undefined && isActive,
    },
    [selectedIdx, onExpand]
  );

  if (isEmpty(data)) return null;

  const virtualItems = virtualizer.getVirtualItems();

  // Create the virtualized list content
  const content = (
    <div
      role="list"
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const item = data[virtualItem.index];
        const idx = virtualItem.index;
        if (!item) return null;

        return (
          <div
            key={`row-id-${item?.hash || item?.id || item?.url || item?.name || item?.most_recent_timestamp}`}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: `${virtualItem.start}px`,
              left: 0,
              width: '100%',
            }}
          >
            {renderRow(item, idx)}
          </div>
        );
      })}
    </div>
  );

  // Return either a scrollable container or the direct list based on pinnedNavigation setting
  return pinnedNavigation ? (
    <div ref={containerRef} className="overflow-y-auto no-scrollbar" style={{ height: containerHeight, width: '100%' }}>
      {content}
      {footer && footer}
    </div>
  ) : (
    <div ref={containerRef} className="overflow-y-auto no-scrollbar" style={{ height: containerHeight, width: '100%' }}>
      {content}
    </div>
  );
};
