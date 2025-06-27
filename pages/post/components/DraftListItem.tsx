import React from 'react';
import { ClockIcon, TrashIcon, CheckCircleIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { DraftStatus, DraftType } from '@/common/constants/farcaster';
import { getUserLocaleDateFromIsoString } from '@/common/helpers/date';
import { ChannelDisplay } from '@/common/components/ChannelDisplay';

type DraftListItemProps = {
  draft: DraftType;
  isSelected: boolean;
  onSelect: (draftId: string) => void;
  onRemove: (draft: DraftType) => void;
  onDuplicate?: (draft: DraftType) => void;
};

const DraftListItem: React.FC<DraftListItemProps> = ({ draft, isSelected, onSelect, onRemove, onDuplicate }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-3 rounded-md cursor-pointer border transition-colors',
        isSelected ? 'bg-muted border-primary' : 'hover:bg-muted/50 border-transparent'
      )}
      onClick={() => onSelect(draft.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {draft.status === DraftStatus.scheduled && <ClockIcon className="w-4 h-4 text-muted-foreground" />}
          {draft.status === DraftStatus.published && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
          <span className="text-sm font-medium truncate max-w-[180px]">
            {draft.text ? draft.text.substring(0, 30) + (draft.text.length > 30 ? '...' : '') : 'New draft'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onDuplicate && (draft.status === DraftStatus.scheduled || draft.status === DraftStatus.published) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(draft);
              }}
              title="Duplicate cast"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(draft);
            }}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center text-xs text-muted-foreground">
        <span>
          {draft.status === DraftStatus.scheduled
            ? `Scheduled for ${getUserLocaleDateFromIsoString(draft.scheduledFor)}`
            : draft.status === DraftStatus.published
              ? `Published ${formatDistanceToNow(new Date(draft.publishedAt), { addSuffix: true })}`
              : `Last edited ${formatDistanceToNow(new Date(draft.updatedAt || draft.createdAt), { addSuffix: true })}`}
        </span>
      </div>
      <ChannelDisplay parentUrl={draft.parentUrl} />
    </div>
  );
};

export default DraftListItem;
