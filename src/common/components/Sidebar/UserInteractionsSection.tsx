import React from 'react';
import { Heart, Repeat2, MessageCircle, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserInteractions } from '@/hooks/queries/useUserInteractions';

interface Props {
  interactions?: UserInteractions;
  isLoading: boolean;
}

/**
 * Displays user interaction statistics in the sidebar
 * Shows likes, recasts, replies, and mentions with timestamps
 * Hidden when no interactions exist
 */
export function UserInteractionsSection({ interactions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-sidebar-border/20">
        <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">Your Interactions</div>
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!interactions) return null;

  const hasInteractions =
    interactions.likes.count > 0 ||
    interactions.recasts.count > 0 ||
    interactions.replies.count > 0 ||
    interactions.mentions.count > 0;

  if (!hasInteractions) return null;

  return (
    <div className="mt-4 pt-4 border-t border-sidebar-border/20">
      <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">Your Interactions</div>
      <div className="space-y-1.5 text-sm text-foreground/70">
        {interactions.likes.count > 0 && (
          <InteractionRow
            icon={<Heart className="h-3.5 w-3.5 text-foreground/50" />}
            count={interactions.likes.count}
            label="likes"
            mostRecent={interactions.likes.mostRecent}
          />
        )}
        {interactions.recasts.count > 0 && (
          <InteractionRow
            icon={<Repeat2 className="h-3.5 w-3.5 text-foreground/50" />}
            count={interactions.recasts.count}
            label="recasts"
            mostRecent={interactions.recasts.mostRecent}
          />
        )}
        {interactions.replies.count > 0 && (
          <InteractionRow
            icon={<MessageCircle className="h-3.5 w-3.5 text-foreground/50" />}
            count={interactions.replies.count}
            label="replies"
            mostRecent={interactions.replies.mostRecent}
          />
        )}
        {interactions.mentions.count > 0 && (
          <InteractionRow
            icon={<AtSign className="h-3.5 w-3.5 text-foreground/50" />}
            count={interactions.mentions.count}
            label="mentions"
            mostRecent={interactions.mentions.mostRecent}
          />
        )}
      </div>
    </div>
  );
}

interface InteractionRowProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  mostRecent: string | null;
}

function InteractionRow({ icon, count, label, mostRecent }: InteractionRowProps) {
  const timeAgo = mostRecent ? formatDistanceToNow(new Date(mostRecent), { addSuffix: false }) : null;

  return (
    <div className="flex items-center gap-2">
      <span>{icon}</span>
      <span>
        {count} {label}
        {timeAgo && <span className="text-foreground/40 text-xs ml-1">· {timeAgo} ago</span>}
      </span>
    </div>
  );
}
