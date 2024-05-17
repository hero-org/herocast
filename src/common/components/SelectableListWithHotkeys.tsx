import React, { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from 'ts-key-enum';
import { useInView } from 'react-intersection-observer';
import isEmpty from "lodash.isempty";

type SelectableListWithHotkeysProps = {
  data: any[],
  renderRow: (item: any, idx: number) => React.ReactNode,
  selectedIdx: number,
  setSelectedIdx: (idx: number) => void,
  onSelect?: (idx: number) => void,
  disableScroll?: boolean,
  onExpand?: (idx: number) => void,
  isActive?: boolean,
  onDown?: () => void,
  onUp?: () => void,
}

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
  isActive = true
}: SelectableListWithHotkeysProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const scollToRef = useRef();
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (!disableScroll && scollToRef.current) {
      (scollToRef.current as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [selectedIdx]);


  useHotkeys(['o', Key.Enter], () => {
    onSelect(selectedIdx);
  }, [selectedIdx], {
    enabled: isActive
  })

  useHotkeys('shift+o', () => {
    onExpand && onExpand(selectedIdx);
  }, [selectedIdx], {
    enabled: onExpand !== undefined && isActive
  })

  useHotkeys(['j', Key.ArrowDown], () => {
    onDown?.();
    
    if (selectedIdx < data.length - 1) {
      setSelectedIdx(selectedIdx + 1);
    }
  }, [data, selectedIdx, setSelectedIdx], {
    enabled: isActive && !isEmpty(data)
  })

  useHotkeys(['k', Key.ArrowUp], () => {
    onUp?.();

    if (selectedIdx === 0) {
      return;
    }

    setSelectedIdx(selectedIdx - 1);
  }, [data, selectedIdx, setSelectedIdx], {
    enabled: isActive && !isEmpty(data)
  })

  if (isEmpty(data)) return null;

  return <ul role="list" className="">
    {data.map((cast: any, idx: number) =>
      cast ? (
        <div
          key={`row-id-${cast?.hash || cast?.id || cast?.url || cast?.name}`}
          ref={(selectedIdx === idx + 1) ? scollToRef : null}>
          {renderRow(cast, idx)}
        </div>
      ) : null
    )}
    <li ref={ref} className="" />
  </ul>
}
