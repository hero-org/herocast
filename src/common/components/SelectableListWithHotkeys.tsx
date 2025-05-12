import React, { useEffect, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Key } from 'ts-key-enum';
import { useInView } from 'react-intersection-observer';
import isEmpty from 'lodash.isempty';

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
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (!disableScroll && scrollToRef.current) {
      scrollToRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
    }
  }, [selectedIdx, pinnedNavigation]);

  useHotkeys(
    ['o', Key.Enter],
    () => {
      onSelect?.(selectedIdx);
    },
    [selectedIdx],
    {
      enabled: isActive,
    }
  );

  useHotkeys(
    'shift+o',
    () => {
      onExpand && onExpand(selectedIdx);
    },
    [selectedIdx],
    {
      enabled: onExpand !== undefined && isActive,
    }
  );

  useHotkeys(
    ['j', Key.ArrowDown],
    () => {
      onDown?.();

      if (selectedIdx < data.length - 1) {
        setSelectedIdx(selectedIdx + 1);
      }
    },
    [data, selectedIdx, setSelectedIdx],
    {
      enabled: isActive && !isEmpty(data),
    }
  );

  useHotkeys(
    ['k', Key.ArrowUp],
    () => {
      onUp?.();

      if (selectedIdx === 0) {
        return;
      }

      setSelectedIdx(selectedIdx - 1);
    },
    [data, selectedIdx, setSelectedIdx],
    {
      enabled: isActive && !isEmpty(data),
    }
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
    <div 
      ref={containerRef} 
      className="overflow-y-auto" 
      style={{ height: containerHeight }}
    >
      {content}
    </div>
  ) : content;
};
