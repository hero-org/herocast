import React from 'react';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import DraftListItem from './DraftListItem';
import { DraftType } from '@/common/constants/farcaster';
import { ChannelType } from '@/common/constants/channels';
import { UUID } from 'crypto';

type DraftListProps = {
  drafts: DraftType[];
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  setSelectedDraftId: (id: string) => void;
  onRemove: (draft: DraftType) => void;
  isActive: boolean;
  getChannelForParentUrl: (params: { channels: ChannelType[]; parentUrl: string | null }) => ChannelType | undefined;
  allChannels: ChannelType[];
};

const DraftList: React.FC<DraftListProps> = ({
  drafts,
  selectedIdx,
  setSelectedIdx,
  setSelectedDraftId,
  onRemove,
  isActive,
  getChannelForParentUrl,
  allChannels,
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
        const channel = getChannelForParentUrl({
          channels: allChannels,
          parentUrl: draft.parentUrl,
        });
        
        return (
          <DraftListItem
            key={draft.id}
            draft={draft}
            isSelected={idx === selectedIdx}
            onSelect={setSelectedDraftId}
            onRemove={onRemove}
            channel={channel}
          />
        );
      }}
      isActive={isActive}
    />
  );
};

export default DraftList;
