import React, { useEffect, useRef } from 'react';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { Key } from 'ts-key-enum';
import { useInView } from 'react-intersection-observer';
import isEmpty from 'lodash.isempty';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { useRouter } from 'next/router';
import { getScopesForPage } from '@/common/constants/hotkeys';

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
}: SelectableListWithHotkeysProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const scrollToRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pageScopes = getScopesForPage(router.pathname);
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (!disableScroll && scrollToRef.current) {
      // Find the correct scrollable container
      let container = null;

      // First try to use the container ref if we're in pinned navigation mode
      if (pinnedNavigation && containerRef.current) {
        container = containerRef.current;
      } else {
        // Look for the main scrollable container with no-scrollbar class
        container =
          scrollToRef.current.closest('.overflow-y-auto.no-scrollbar') ||
          scrollToRef.current.closest('[class*="overflow-y-auto"]') ||
          document.querySelector('.overflow-y-auto.no-scrollbar');
      }

      if (container) {
        // Get the element's position relative to the container
        const elementRect = scrollToRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate the scroll position needed to show the element
        const elementTop = elementRect.top - containerRect.top;
        const elementBottom = elementRect.bottom - containerRect.top;
        const containerHeight = container.clientHeight;

        // Check if element is outside the visible area
        if (elementTop < 64) {
          // Account for sticky header
          // Scroll up to show the element
          container.scrollTop += elementTop - 64;
        } else if (elementBottom > containerHeight) {
          // Scroll down to show the element
          container.scrollTop += elementBottom - containerHeight + 20; // Add small margin
        }
      } else {
        // Fallback to scrollIntoView but prevent document scrolling
        try {
          scrollToRef.current.scrollIntoView({
            behavior: 'auto',
            block: 'start',
          });
        } catch (e) {
          // Ignore scrollIntoView errors if element is not in DOM
        }
      }
    }
  }, [selectedIdx, pinnedNavigation]);

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

  // Create the list content
  const content = (
    <ul role="list" className="">
      {data.map((item: any, idx: number) => {
        return item ? (
          <div
            key={`row-id-${item?.hash || item?.id || item?.url || item?.name || item?.most_recent_timestamp}`}
            ref={selectedIdx === idx ? scrollToRef : null}
          >
            {renderRow(item, idx)}
          </div>
        ) : null;
      })}
      <li ref={ref} className="" />
    </ul>
  );

  // Return either a scrollable container or the direct list based on pinnedNavigation setting
  return pinnedNavigation ? (
    <div ref={containerRef} className="overflow-y-auto" style={{ height: containerHeight }}>
      {content}
    </div>
  ) : (
    content
  );
};
