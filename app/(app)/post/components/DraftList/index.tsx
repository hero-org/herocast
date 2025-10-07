'use client';

import React from 'react';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import DraftListItem from '../DraftListItem';
import { DraftType } from '@/common/constants/farcaster';

type DraftListProps = {
  drafts: DraftType[];
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  setSelectedDraftId: (id: string) => void;
  onRemove: (draft: DraftType) => void;
  onDuplicate?: (draft: DraftType) => void;
  isActive: boolean;
};

const DraftList: React.FC<DraftListProps> = ({
  drafts,
  selectedIdx,
  setSelectedIdx,
  setSelectedDraftId,
  onRemove,
  onDuplicate,
  isActive,
}) => {
  return (
    <SelectableListWithHotkeys
      data={drafts}
      selectedIdx={selectedIdx}
      setSelectedIdx={(idx) => {
        setSelectedIdx(idx);
        setSelectedDraftId(drafts[idx]?.id);
      }}
      renderRow={(draft, idx) => {
        return (
          <DraftListItem
            key={draft.id}
            draft={draft}
            isSelected={idx === selectedIdx}
            onSelect={setSelectedDraftId}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
          />
        );
      }}
      isActive={isActive}
    />
  );
};

export default DraftList;
