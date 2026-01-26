'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PhotoIcon } from '@heroicons/react/20/solid';
import { CheckCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { GripVertical, Loader2 } from 'lucide-react';
import NewCastEditor from '@/common/components/Editor/NewCastEditor';
import type { DraftType } from '@/common/constants/farcaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ThreadPostCardProps = {
  draft: DraftType;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  canAddMore: boolean;
  onRemove: () => void;
  onAddPost: () => void;
  onUploadMedia?: (file: File) => void;
  isPublishing?: boolean;
  isCurrentlyPublishing?: boolean;
  hideSchedule?: boolean;
  /** User's profile picture URL */
  userPfpUrl?: string;
  /** User's display name for alt text */
  userName?: string;
};

export default function ThreadPostCard({
  draft,
  index,
  isFirst,
  isLast,
  canRemove,
  canAddMore,
  onRemove,
  onAddPost,
  onUploadMedia,
  isPublishing = false,
  isCurrentlyPublishing = false,
  hideSchedule = true,
  userPfpUrl,
  userName,
}: ThreadPostCardProps) {
  // @dnd-kit sortable hook - uses draft.id as the unique identifier
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: draft.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleMediaUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onUploadMedia) {
        onUploadMedia(file);
      }
    };
    input.click();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group flex gap-3 py-2',
        isCurrentlyPublishing && 'ring-1 ring-primary/50 rounded-lg',
        isPublishing && !isCurrentlyPublishing && 'opacity-50',
        isDragging && 'z-50 bg-background rounded-lg shadow-lg ring-1 ring-border'
      )}
    >
      {/* Avatar column with drag handle and thread line */}
      <div className="relative flex-shrink-0 flex flex-col items-center">
        {/* Drag handle area - listeners and attributes from @dnd-kit */}
        <div
          {...attributes}
          {...listeners}
          className={cn('relative flex items-center cursor-grab active:cursor-grabbing select-none touch-none')}
        >
          {/* Drag handle icon - visible on hover via parent group */}
          <div
            className={cn(
              'absolute -left-5 top-3 opacity-0 group-hover:opacity-100 transition-opacity',
              'text-muted-foreground/50'
            )}
          >
            <GripVertical className="w-4 h-4 pointer-events-none" />
          </div>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {userPfpUrl ? (
              <img
                src={userPfpUrl}
                alt={userName || 'User'}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Vertical thread line connecting avatars */}
        {!isLast && <div className="flex-1 w-0.5 mt-2 bg-muted/60" />}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Editor - compact wrapper */}
        <div className="relative">
          <NewCastEditor
            draft={draft}
            hideChannel={!isFirst}
            hideSchedule={hideSchedule}
            hideSubmit={true}
            hideToolbar={!isFirst}
            borderless={true}
          />
        </div>

        {/* Footer toolbar - Typefully style */}
        <div className="flex items-center gap-1.5 mt-1">
          {/* Post number with publishing status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground/60 font-medium tabular-nums flex items-center gap-1 px-1">
                {isPublishing ? (
                  isCurrentlyPublishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                  )
                ) : null}
                #{index + 1}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Post #{index + 1}
            </TooltipContent>
          </Tooltip>

          {/* Media upload button */}
          {!isPublishing && onUploadMedia && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleMediaUpload}
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded',
                    'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50',
                    'transition-colors'
                  )}
                  title="Add media"
                >
                  <PhotoIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Add media
              </TooltipContent>
            </Tooltip>
          )}

          {/* Add post button */}
          {canAddMore && !isPublishing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAddPost}
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded',
                    'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50',
                    'transition-colors'
                  )}
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Add post below
              </TooltipContent>
            </Tooltip>
          )}

          {/* Delete button */}
          {canRemove && !isPublishing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRemove}
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded',
                    'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10',
                    'transition-colors'
                  )}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Delete post
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
