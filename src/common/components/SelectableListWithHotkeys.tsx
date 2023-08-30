import React, { useEffect, useRef } from "react";
import { CastType } from "@/common/constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import { Key } from 'ts-key-enum';
import { useInView } from 'react-intersection-observer';
import isEmpty from "lodash.isempty";

type SelectableListWithHotkeysProps = {
  data: any[],
  renderRow: (item: any, idx: number) => React.ReactNode,
  selectedIdx: number,
  setSelectedIdx: (idx: number) => void,
  onSelect: (idx: number) => void,
  onExpand: (idx: number) => void,
  isActive?: boolean,
}

export const SelectableListWithHotkeys = ({ data, renderRow, selectedIdx, setSelectedIdx, onSelect, onExpand, isActive = true }: SelectableListWithHotkeysProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

  const scollToRef = useRef();
  // scroll to selected cast when selectedCastIdx changes
  useEffect(() => {
    if (scollToRef.current) {
      // @ts-ignore
      scollToRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedIdx]);


  useHotkeys(['o', Key.Enter], () => {
    onSelect(selectedIdx);
  }, [selectedIdx], {
  })

  useHotkeys('shift+o', () => {
    onExpand(selectedIdx);
  }, [selectedIdx], {
  })

  useHotkeys(['j', Key.ArrowDown], () => {
    if (selectedIdx < data.length - 1) {
      setSelectedIdx(selectedIdx + 1);
    }
  }
    , [data, selectedIdx, setSelectedIdx], {
    enabled: isActive && !isEmpty(data)
  })

  useHotkeys(['k', Key.ArrowUp], () => {
    if (selectedIdx === 0) {
      return;
    }
    setSelectedIdx(selectedIdx - 1);
  }, [data, selectedIdx, setSelectedIdx], {
    enabled: isActive && !isEmpty(data)
  })

  return <ul role="list" className="">
    {data.map((cast: CastType, idx: number) =>
      <div ref={(selectedIdx === idx - 2) ? scollToRef : null}>
        {renderRow(cast, idx)}
      </div>
    )}
    <li ref={ref} className="" />
  </ul>
}
