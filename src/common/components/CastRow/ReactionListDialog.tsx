import type React from 'react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCastReactions } from '@/hooks/queries/useCastReactions';

type ReactionListType = 'likes' | 'recasts';

interface ReactionListDialogProps {
  castHash: string;
  type: ReactionListType;
  children: React.ReactNode;
}

const TITLE_BY_TYPE: Record<ReactionListType, string> = {
  likes: 'Liked by',
  recasts: 'Recasted by',
};

export const ReactionListDialog: React.FC<ReactionListDialogProps> = ({ castHash, type, children }) => {
  const [open, setOpen] = useState(false);

  // Only fetch once the dialog has been opened to avoid firing a request for
  // every cast in the feed.
  const { data, isLoading } = useCastReactions(castHash, type, { enabled: open });
  const reactions = data?.reactions ?? [];

  const renderLoadingState = () => (
    <ul className="flex flex-col gap-1">
      {Array.from({ length: 6 }).map((_, idx) => (
        <li key={`reaction-skeleton-${idx}`} className="flex items-center gap-3 px-1 py-1.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );

  const renderEmptyState = () => <p className="px-1 py-6 text-center text-sm text-muted-foreground">No one yet.</p>;

  const renderReactors = () => (
    <ul className="flex flex-col gap-0.5">
      {reactions.map((reaction) => (
        <li key={`${reaction.reaction_type}-${reaction.user.fid}-${reaction.reaction_timestamp}`}>
          <div className="flex items-center gap-3 rounded-md px-1 py-1.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={reaction.user.pfp_url} alt={reaction.user.display_name} />
              <AvatarFallback>{reaction.user.display_name?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{reaction.user.display_name}</span>
              <span className="truncate text-xs text-muted-foreground">@{reaction.user.username}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="max-w-sm"
        onClick={(event) => {
          // Keep clicks inside the dialog from bubbling to the underlying cast row.
          event.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle>{TITLE_BY_TYPE[type]}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? renderLoadingState() : reactions.length > 0 ? renderReactors() : renderEmptyState()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
