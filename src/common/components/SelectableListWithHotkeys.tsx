import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { Key } from 'ts-key-enum';
import isEmpty from 'lodash.isempty';
import { HotkeyScopes, HotkeyScope } from '@/common/constants/hotkeys';
import { usePathname } from 'next/navigation';
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
  pinnedNavigation?: boolean;
  containerHeight?: string;
  scopes?: HotkeyScope[];
  footer?: React.ReactNode;
  estimatedItemHeight?: number;
  getItemKey?: (item: any, index: number) => string;
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
  pinnedNavigation = false,
  containerHeight = '80vh',
  scopes,
  footer,
  estimatedItemHeight = 250,
  getItemKey: externalGetItemKey,
}: SelectableListWithHotkeysProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || '/';
  const pageScopes = scopes ?? getScopesForPage(pathname);

  // Track first item to detect feed refresh (not pagination)
  const firstItemKey = useMemo(() => {
    if (data.length === 0) return null;
    return data[0]?.hash || data[0]?.id || null;
  }, [data]);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5,
    getItemKey: (index) => {
      const item = data[index];
      return item?.hash || item?.id || `idx-${index}`;
    },
  });

  // Only reset when first item changes (feed refresh), not on pagination
  const prevFirstItemKeyRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const shouldReset =
      prevFirstItemKeyRef.current !== null && firstItemKey !== null && prevFirstItemKeyRef.current !== firstItemKey;

    if (shouldReset) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Virtualizer] Feed refreshed, resetting');
      }
      virtualizer.scrollToIndex(0, { align: 'start', behavior: 'auto' });
      virtualizer.measure();
    }
    prevFirstItemKeyRef.current = firstItemKey;
  }, [firstItemKey, virtualizer]);

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
      if (onExpand) {
        onExpand(selectedIdx);
      }
    },
    {
      scopes: pageScopes,
      enabled: onExpand !== undefined && isActive,
    },
    [selectedIdx, onExpand]
  );

  if (isEmpty(data)) return null;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={containerRef} className="overflow-y-auto no-scrollbar" style={{ height: containerHeight, width: '100%' }}>
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
              key={
                externalGetItemKey
                  ? externalGetItemKey(item, idx)
                  : `row-id-${item?.hash || item?.id || item?.url || item?.name || item?.most_recent_timestamp}`
              }
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
      {pinnedNavigation && footer}
    </div>
  );
};
