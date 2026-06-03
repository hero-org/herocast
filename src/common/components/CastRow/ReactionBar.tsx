import get from 'lodash.get';
import map from 'lodash.map';
import { ExternalLink, Heart, Heart as HeartFilledIcon, MessageSquare, MessagesSquare, Repeat2 } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { CastReactionType } from '@/common/constants/farcaster';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import type { FarcasterCast } from '@/common/types/farcaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLikeCast, useRecast, useRemoveRecast, useUnlikeCast } from '@/hooks/mutations/useCastActions';
import { cn } from '@/lib/utils';
import { endTiming, startTiming } from '@/stores/usePerformanceStore';
import { toastInfoReadOnlyMode } from '../../helpers/toast';
import HotkeyTooltipWrapper from '../HotkeyTooltipWrapper';
import { ReactionListDialog } from './ReactionListDialog';

interface ReactionBarProps {
  cast: FarcasterCast;
  isSelected?: boolean;
  userFid: number;
  canSendReaction: boolean;
  onReply: () => void;
  onQuote: () => void;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  cast,
  isSelected,
  userFid,
  canSendReaction,
  onReply,
  onQuote,
}) => {
  const [didLike, setDidLike] = useState(false);
  const [didRecast, setDidRecast] = useState(false);

  const authorFid = cast?.author.fid;

  // Initialize mutation hooks
  const likeCast = useLikeCast();
  const unlikeCast = useUnlikeCast();
  const recastMutation = useRecast();
  const removeRecastMutation = useRemoveRecast();

  const reactions = useMemo(() => {
    const repliesCount = cast.replies?.count || 0;
    const recastsCount = cast.reactions?.recasts_count || 0;
    const likesCount = cast.reactions?.likes_count || 0;

    const likeFids = map(cast.reactions?.likes, 'fid') || [];
    const recastFids = map(cast.reactions?.recasts, 'fid') || [];
    return {
      [CastReactionType.replies]: { count: repliesCount },
      [CastReactionType.recasts]: {
        count: recastsCount + Number(didRecast),
        isActive: didRecast || recastFids.includes(userFid),
      },
      [CastReactionType.likes]: {
        count: likesCount + Number(didLike),
        isActive: didLike || likeFids.includes(userFid),
      },
    };
  }, [
    cast.replies?.count,
    cast.reactions?.recasts_count,
    cast.reactions?.likes_count,
    cast.reactions?.likes,
    cast.reactions?.recasts,
    didRecast,
    didLike,
    userFid,
  ]);

  const getIconForCastReactionType = (
    reactionType: CastReactionType,
    isActive?: boolean
  ): React.ReactElement | null => {
    const className = cn(isActive ? 'text-foreground/70' : '', 'mt-0.5 w-4 h-4 mr-1');

    switch (reactionType) {
      case CastReactionType.likes:
        return isActive ? (
          <HeartFilledIcon className={className} aria-hidden="true" fill="currentColor" />
        ) : (
          <Heart className={className} aria-hidden="true" />
        );
      case CastReactionType.recasts:
        return <Repeat2 className={className} aria-hidden="true" />;
      case CastReactionType.quote:
        return <MessagesSquare className={className} aria-hidden="true" />;
      case CastReactionType.replies:
        return <MessageSquare className={className} aria-hidden="true" />;
      case CastReactionType.links:
        return <ExternalLink className={className} aria-hidden="true" />;
      default:
        return null;
    }
  };

  const onClickReaction = async (key: CastReactionType, isActive: boolean) => {
    if (key === CastReactionType.links) {
      return;
    }

    // Start performance measurement
    const timingId = startTiming(`click-${key}`);

    // Immediate optimistic update for instant UI feedback
    if (key === CastReactionType.likes) {
      setDidLike(!isActive);
    } else if (key === CastReactionType.recasts) {
      setDidRecast(!isActive);
    }

    // End timing for UI update (should be <100ms)
    endTiming(timingId, 100);

    if (!canSendReaction) {
      toastInfoReadOnlyMode();
      // Rollback optimistic update for read-only mode
      if (key === CastReactionType.likes) {
        setDidLike(isActive);
      } else if (key === CastReactionType.recasts) {
        setDidRecast(isActive);
      }
      return;
    }

    try {
      if (key === CastReactionType.replies) {
        onReply();
        return;
      }

      if (key === CastReactionType.quote) {
        onQuote();
        return;
      }

      // Use mutation hooks for likes and recasts
      const mutationParams = {
        castHash: cast.hash,
        authorFid: Number(authorFid),
      };

      if (key === CastReactionType.likes) {
        if (isActive) {
          unlikeCast.mutate(mutationParams, {
            onError: () => {
              // Rollback local state on error
              setDidLike(true);
            },
          });
        } else {
          likeCast.mutate(mutationParams, {
            onError: () => {
              // Rollback local state on error
              setDidLike(false);
            },
          });
        }
      } else if (key === CastReactionType.recasts) {
        if (isActive) {
          removeRecastMutation.mutate(mutationParams, {
            onError: () => {
              // Rollback local state on error
              setDidRecast(true);
            },
          });
        } else {
          recastMutation.mutate(mutationParams, {
            onError: () => {
              // Rollback local state on error
              setDidRecast(false);
            },
          });
        }
      }

      // Success: mutations handle cache updates automatically
    } catch (error) {
      console.error(`Error in onClickReaction: ${error}`);

      // Rollback optimistic update on error
      if (key === CastReactionType.likes) {
        setDidLike(isActive);
      } else if (key === CastReactionType.recasts) {
        setDidRecast(isActive);
      }
    }
  };

  // Cast action hotkeys - only active when this cast is selected
  useAppHotkeys(
    'l',
    () => {
      if (isSelected) {
        onClickReaction(CastReactionType.likes, reactions[CastReactionType.likes].isActive);
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: isSelected,
    },
    [isSelected, reactions, onClickReaction]
  );

  useAppHotkeys(
    'shift+r',
    () => {
      if (isSelected) {
        onClickReaction(CastReactionType.recasts, reactions[CastReactionType.recasts].isActive);
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: isSelected,
    },
    [isSelected, reactions, onClickReaction]
  );

  const renderReaction = (
    key: CastReactionType,
    isActive: boolean,
    count?: number | string,
    icon?: React.ReactElement | null
  ) => {
    // The likes / recasts counts open a list of the users who reacted. The
    // icon still toggles the reaction (handled by the wrapper div below), so
    // the count's own click stops propagation to avoid liking/recasting.
    const isReactorListType = key === CastReactionType.likes || key === CastReactionType.recasts;
    const hasReactors = typeof count === 'number' && count > 0;
    const countSpan = count !== null && <span className="">{count}</span>;

    return (
      <div
        key={`cast-${cast.hash}-${key}`}
        className="mt-1.5 flex align-center text-sm text-foreground/60 hover:text-foreground hover:bg-background/50 py-1 px-1.5 rounded-md"
        onClick={async (event) => {
          event.stopPropagation();
          onClickReaction(key, isActive);
        }}
      >
        {icon}
        {isReactorListType && hasReactors ? (
          <ReactionListDialog castHash={cast.hash} type={key}>
            <span
              className="cursor-pointer hover:underline"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {count}
            </span>
          </ReactionListDialog>
        ) : (
          countSpan
        )}
      </div>
    );
  };

  const linksCount = cast?.embeds ? cast.embeds.length : 0;
  const isOnchainLink = linksCount > 0 && 'url' in cast.embeds[0] ? cast.embeds[0]?.url?.startsWith('chain:') : false;

  return (
    <div className="-ml-1.5 flex space-x-3">
      {Object.entries(reactions).map(([key, reactionInfo]) => {
        const isActive = get(reactionInfo, 'isActive', false);
        const icon = getIconForCastReactionType(key as CastReactionType, isActive);
        const reaction = renderReaction(key as CastReactionType, isActive, reactionInfo.count, icon);

        if (key === 'likes' && isSelected) {
          return (
            <TooltipProvider key={`cast-${cast.hash}-${key}-${reaction}`} delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey="L" side="bottom">
                {reaction}
              </HotkeyTooltipWrapper>
            </TooltipProvider>
          );
        } else if (key === 'recasts' && isSelected) {
          return (
            <TooltipProvider key={`cast-${cast.hash}-${key}-${reaction}`} delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey="Shift + R" side="bottom">
                {reaction}
              </HotkeyTooltipWrapper>
            </TooltipProvider>
          );
        } else if (key === 'replies' && isSelected) {
          return (
            <TooltipProvider key={`cast-${cast.hash}-${key}-${reaction}`} delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey="R" side="bottom">
                {reaction}
              </HotkeyTooltipWrapper>
            </TooltipProvider>
          );
        } else {
          return reaction;
        }
      })}
      {linksCount && !isOnchainLink ? (
        <TooltipProvider key={`cast-${cast.hash}-link`} delayDuration={50} skipDelayDuration={0}>
          <HotkeyTooltipWrapper hotkey="O" side="bottom">
            <a
              tabIndex={-1}
              href={'url' in cast.embeds[0] ? cast.embeds[0].url : '#'}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer"
            >
              {renderReaction(
                CastReactionType.links,
                linksCount > 1,
                linksCount ?? undefined,
                getIconForCastReactionType(CastReactionType.links)
              )}
            </a>
          </HotkeyTooltipWrapper>
        </TooltipProvider>
      ) : null}
      <TooltipProvider key={`cast-${cast.hash}-quote`} delayDuration={50} skipDelayDuration={0}>
        <HotkeyTooltipWrapper hotkey="Q" side="bottom">
          {renderReaction(CastReactionType.quote, true, undefined, getIconForCastReactionType(CastReactionType.quote))}
        </HotkeyTooltipWrapper>
      </TooltipProvider>
    </div>
  );
};
