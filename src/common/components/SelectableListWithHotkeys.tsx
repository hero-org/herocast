import React from "react";
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
}

export const SelectableListWithHotkeys = ({ data, renderRow, selectedIdx, setSelectedIdx, onSelect, onExpand }: SelectableListWithHotkeysProps) => {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 100,
  });

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
    enabled: !isEmpty(data)
  })

  useHotkeys(['k', Key.ArrowUp], () => {
    if (selectedIdx === 0) {
      return;
    }
    setSelectedIdx(selectedIdx - 1);
  }, [data, selectedIdx, setSelectedIdx], {
    enabled: !isEmpty(data)
  })

  return <ul role="list" className="">
    {data.map((cast: CastType, idx: number) => renderRow(cast, idx))}
    <li ref={ref} className="" />
  </ul>
}
