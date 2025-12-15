import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { startTiming, endTiming } from '@/stores/usePerformanceStore';
import { useChannelLookup } from '../hooks/useChannelLookup';
import { castTextStyle } from '@/common/helpers/css';
import { CastReactionType, createParentCastId, createEmbedCastId } from '@/common/constants/farcaster';
import { ChannelType } from '@/common/constants/channels';
import { useAccountStore } from '@/stores/useAccountStore';
import {
  ArrowPathRoundedSquareIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartFilledIcon } from '@heroicons/react/24/solid';
import { removeCast } from '../helpers/farcaster';
import includes from 'lodash.includes';
import map from 'lodash.map';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import HotkeyTooltipWrapper from './HotkeyTooltipWrapper';
import get from 'lodash.get';
import Linkify from 'linkify-react';
import { ErrorBoundary } from '@sentry/react';
import { renderEmbedForUrl } from './Embeds';
import EmbedCarousel from './Embeds/EmbedCarousel';
import OpenGraphImage from './Embeds/OpenGraphImage';
import NftSaleEmbed from './Embeds/NftSaleEmbed';
import SwapEmbed from './Embeds/SwapEmbed';
import { isNftSaleUrl, isSwapUrl, isZapperTransactionUrl } from '@/common/helpers/onchain';
import ProfileHoverCard from './ProfileHoverCard';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { registerPlugin } from 'linkifyjs';
import CashtagHoverCard from './CashtagHoverCard';
import mentionPlugin, { cashtagPlugin, channelPlugin } from '../helpers/linkify';
import { AccountPlatformType } from '../constants/accounts';
import {
  toastCopiedToClipboard,
  toastInfoReadOnlyMode,
  toastSuccessCastDeleted,
  toastUnableToDeleteCast,
} from '../helpers/toast';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { useDataStore } from '@/stores/useDataStore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useDraftStore } from '@/stores/useDraftStore';
import { format, formatDistanceToNowStrict, lightFormat } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowPathIcon, EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { addToClipboard } from '../helpers/clipboard';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProfileByFid } from '@/hooks/queries/useProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QuickListManageDialog } from './QuickListManageDialog';
import { useLikeCast, useUnlikeCast, useRecast, useRemoveRecast } from '@/hooks/mutations/useCastActions';

// Register linkify plugins once globally to avoid hot reload warnings
if (typeof window !== 'undefined' && !window.__linkify_plugins_registered) {
  registerPlugin('mention', mentionPlugin);
  registerPlugin('cashtag', cashtagPlugin);
  registerPlugin('channel', channelPlugin);
  window.__linkify_plugins_registered = true;
}

export type CastToReplyType = {
  hash: string;
  author: {
    fid: number;
    username: string;
  };
};

interface CastRowProps {
  cast:
    | (CastWithInteractions & {
        inclusion_context?: {
          is_following_recaster: boolean;
          is_following_author: boolean;
        };
      })
    | CastToReplyType;
  showChannel?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
  isThreadView?: boolean;
  isEmbed?: boolean;
  hideReactions?: boolean;
  showParentDetails?: boolean;
  hideAuthor?: boolean;
  showAdminActions?: boolean;
  recastedByFid?: number;
  onCastClick?: () => void;
}

const renderMention = ({ attributes, content }) => {
  const { userFid } = attributes;
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
    >
      <MemoizedProfileHoverCard username={content.slice(1)} viewerFid={userFid}>
        {content}
      </MemoizedProfileHoverCard>
    </span>
  );
};

const renderLink = ({ attributes, content }) => {
  const { href } = attributes;
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
        window.open(href, '_blank');
      }}
      rel="noopener noreferrer"
    >
      {content}
    </span>
  );
};

const renderChannel = ({ content }) => {
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
        // Navigate to channel when clicked
        const { setSelectedChannelByName } = useAccountStore.getState();
        const router = window.location;
        setSelectedChannelByName(content.slice(1)); // Remove the / prefix
        if (router.pathname !== '/feeds') {
          window.location.href = '/feeds';
        }
      }}
      rel="noopener noreferrer"
    >
      {content}
    </span>
  );
};

const renderCashtag = ({ attributes, content }) => {
  if (!content || content.length < 3) {
    return content;
  }

  const tokenSymbol = content.slice(1);
  if (tokenSymbol === 'usd') return null;

  const { userFid } = attributes;

  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
    >
      <CashtagHoverCard tokenSymbol={tokenSymbol.toUpperCase()} userFid={userFid}>
        {content}
      </CashtagHoverCard>
    </span>
  );
};

const linkifyOptions = {
  render: {
    url: renderLink,
    mention: renderMention,
    cashtag: renderCashtag,
    channel: renderChannel,
  },
  truncate: 42,
};

const MemoizedProfileHoverCard = React.memo(ProfileHoverCard);

const CastRowComponent = ({
  cast,
  isSelected,
  showChannel,
  onSelect,
  isEmbed = false,
  isThreadView = false,
  hideReactions = false,
  showParentDetails = false,
  hideAuthor = false,
  showAdminActions = false,
  recastedByFid,
  onCastClick,
}: CastRowProps) => {
  const { accounts, selectedAccountIdx, setSelectedChannelByName, setSelectedChannelUrl } = useAccountStore();

  const { setCastModalDraftId, setCastModalView, openNewCastModal } = useNavigationStore();
  const { addNewPostDraft } = useDraftStore();
  const { updateSelectedCast } = useDataStore();

  // Fetch recaster profile if this cast was recasted by someone we're following
  const { data: recasterProfile } = useProfileByFid(recastedByFid, {
    enabled: !!recastedByFid,
  });

  const [didLike, setDidLike] = useState(false);
  const [didRecast, setDidRecast] = useState(false);
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);
  const authorFid = cast?.author.fid;
  const canSendReaction = selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;

  // Initialize mutation hooks
  const likeCast = useLikeCast();
  const unlikeCast = useUnlikeCast();
  const recastMutation = useRecast();
  const removeRecastMutation = useRemoveRecast();

  const onReply = () => {
    setCastModalView(CastModalView.Reply);
    updateSelectedCast(cast);
    addNewPostDraft({
      parentCastId: createParentCastId(cast.author.fid, cast.hash, 'CastRow.onReply'),
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  };

  const onQuote = () => {
    setCastModalView(CastModalView.Quote);
    updateSelectedCast(cast);
    addNewPostDraft({
      embeds: [
        {
          // Store hash as string for JSON serialization - will be converted to bytes in prepareCastBody
          castId: createEmbedCastId(cast.author.fid, cast.hash, 'CastRow.onQuote') as unknown as {
            fid: number;
            hash: Uint8Array;
          },
        },
      ],
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  };

  const reactions = useMemo(() => {
    const repliesCount = cast.replies?.count || 0;
    const recastsCount = cast.reactions?.recasts_count || cast.recasts?.count || 0;
    const likesCount = cast.reactions?.likes_count || cast.reactions?.count || 0;

    const likeFids = map(cast.reactions?.likes, 'fid') || [];
    const recastFids = map(cast.reactions?.recasts, 'fid') || [];
    return {
      [CastReactionType.replies]: { count: repliesCount },
      [CastReactionType.recasts]: {
        count: recastsCount + Number(didRecast),
        isActive: didRecast || includes(recastFids, userFid),
      },
      [CastReactionType.likes]: {
        count: likesCount + Number(didLike),
        isActive: didLike || includes(likeFids, userFid),
      },
    };
  }, [
    cast.replies?.count,
    cast.reactions?.recasts_count,
    cast.reactions?.likes_count,
    cast.reactions?.count,
    cast.recasts?.count,
    cast.reactions?.likes,
    cast.reactions?.recasts,
    didRecast,
    didLike,
    userFid,
  ]);

  // Use on-demand channel lookup instead of loading all channels
  const parentUrl = 'parent_url' in cast ? cast.parent_url : null;
  const { channel: parentChannel } = useChannelLookup(parentUrl);

  // Detect if this cast is replying to an external URL (not a channel, not a cast)
  const isExternalUrlReply = Boolean(parentUrl && !parentChannel && !cast.parent_hash);

  const getChannelForParentUrl = useCallback(
    (url: string | null): ChannelType | undefined => (url === parentUrl ? parentChannel : undefined),
    [parentUrl, parentChannel]
  );

  const getIconForCastReactionType = (reactionType: CastReactionType, isActive?: boolean): JSX.Element | undefined => {
    const className = cn(isActive ? 'text-foreground/70' : '', 'mt-0.5 w-4 h-4 mr-1');

    switch (reactionType) {
      case CastReactionType.likes:
        return isActive ? (
          <HeartFilledIcon className={className} aria-hidden="true" />
        ) : (
          <HeartIcon className={className} aria-hidden="true" />
        );
      case CastReactionType.recasts:
        return <ArrowPathRoundedSquareIcon className={className} aria-hidden="true" />;
      case CastReactionType.quote:
        return <ChatBubbleLeftRightIcon className={className} aria-hidden="true" />;
      case CastReactionType.replies:
        return <ChatBubbleLeftIcon className={className} aria-hidden="true" />;
      case CastReactionType.links:
        return <ArrowTopRightOnSquareIcon className={className} aria-hidden="true" />;
      default:
        return undefined;
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

  // Hotkey for managing lists
  useAppHotkeys(
    'm',
    () => {
      if (isSelected && 'author' in cast && cast.author.fid) {
        setIsListDialogOpen(true);
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: isSelected && 'author' in cast && !!cast.author.fid,
    },
    [isSelected, cast]
  );

  const renderReaction = (key: CastReactionType, isActive: boolean, count?: number | string, icon?: JSX.Element) => {
    return (
      <div
        key={`cast-${cast.hash}-${key}`}
        className="mt-1.5 flex align-center text-sm text-foreground/40 hover:text-foreground hover:bg-background/50 py-1 px-1.5 rounded-md"
        onClick={async (event) => {
          event.stopPropagation();
          onClickReaction(key, isActive);
        }}
      >
        {icon}
        {count !== null && <span className="">{count}</span>}
      </div>
    );
  };

  const renderCastReactions = (cast: CastWithInteractions) => {
    const linksCount = cast?.embeds ? cast.embeds.length : 0;
    const isOnchainLink = linksCount > 0 && 'url' in cast.embeds[0] ? cast.embeds[0].url.startsWith('chain:') : false;

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
            {renderReaction(
              CastReactionType.quote,
              true,
              undefined,
              getIconForCastReactionType(CastReactionType.quote)
            )}
          </HotkeyTooltipWrapper>
        </TooltipProvider>
      </div>
    );
  };

  const processedText = useMemo(
    () =>
      'text' in cast && cast.text ? (
        <ErrorBoundary>
          <Linkify
            as="span"
            options={{
              ...linkifyOptions,
              attributes: { userFid, setSelectedChannelByName },
            }}
          >
            {cast.text.trimEnd()}{' '}
          </Linkify>
        </ErrorBoundary>
      ) : null,
    [cast.text, userFid, setSelectedChannelByName]
  );

  const renderEmbeds = () => {
    if (!('embeds' in cast) || !cast.embeds.length) {
      return null;
    }

    // Filter out Zapper transaction URLs (we show custom embeds for those via renderExternalUrlReply)
    const filteredEmbeds = cast.embeds.filter((embed) => !isZapperTransactionUrl(embed.url));
    if (filteredEmbeds.length === 0) {
      return null;
    }

    return (
      <ErrorBoundary>
        <EmbedCarousel embeds={filteredEmbeds} hideReactions={hideReactions} isSelected={isSelected} />
      </ErrorBoundary>
    );
  };

  const renderExternalUrlReply = () => {
    if (!isExternalUrlReply || !parentUrl) return null;

    // Route custom URI schemes to appropriate embed component
    const embedComponent = isNftSaleUrl(parentUrl) ? (
      <NftSaleEmbed url={parentUrl} isSelected={isSelected} />
    ) : isSwapUrl(parentUrl) ? (
      <SwapEmbed url={parentUrl} isSelected={isSelected} />
    ) : (
      <OpenGraphImage url={parentUrl} />
    );

    return (
      <div className="flex items-start gap-x-2 mb-2">
        {/* Left column: Link icon with connecting line - matches avatar column width */}
        {!isEmbed && !hideAuthor && (
          <div className="relative flex flex-col items-center shrink-0 w-10">
            {/* Link icon container - solid background with border */}
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted border border-muted-foreground/20">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            {/* Vertical connecting line from icon to avatar below */}
            <div className="flex-1 w-0.5 bg-foreground/10 min-h-[8px]" />
          </div>
        )}

        {/* Embed card - aligned with link icon */}
        <div className={cn('flex items-center flex-1 min-w-0', (isEmbed || hideAuthor) && 'ml-0')}>
          {embedComponent}
        </div>
      </div>
    );
  };

  const renderRecastBadge = () => {
    const shouldShowBadge =
      'inclusion_context' in cast &&
      cast.inclusion_context?.is_following_recaster &&
      !cast.inclusion_context?.is_following_author;

    if (!recastedByFid && !shouldShowBadge) return null;

    // Use recasterProfile from React Query hook if recastedByFid is provided,
    // otherwise find the recaster from reaction data
    const recaster = recastedByFid
      ? recasterProfile
      : cast.reactions?.recasts?.find((recast) => recast?.viewer_context?.following === true);

    const badge = (
      <span
        className={cn('ml-10', 'h-5 inline-flex truncate text-sm font-semibold text-foreground/40 hover:underline')}
      >
        <ArrowPathIcon className="h-4 w-4 mt-0.5 mr-1" />
        {recaster && `Recasted by ${recaster.fname || recaster.username}`}
      </span>
    );

    if (recaster) {
      return (
        <Link href={`/profile/${recaster.fname}`} prefetch={false}>
          {badge}
        </Link>
      );
    }

    return badge;
  };

  const channel = useMemo(
    () => (showChannel && 'parent_url' in cast ? getChannelForParentUrl(cast.parent_url) : null),
    [showChannel, cast, getChannelForParentUrl]
  );

  const authorInfo = useMemo(
    () => ({
      pfpUrl: cast.author.pfp_url || cast.author?.pfp?.url || cast.author?.avatar_url,
      username: cast.author.username || cast.author.fname,
      displayName: cast.author.display_name || cast.author.displayName,
    }),
    [cast.author]
  );

  const renderChannelButton = () =>
    showChannel &&
    channel && (
      <Badge
        className="truncate items-top bg-blue-400/10  hover:bg-blue-400/20 text-blue-400 hover:text-blue-600  border-blue-400/5 shadow-none"
        onClick={() => setSelectedChannelUrl(channel.url)}
      >
        {channel.name}
      </Badge>
    );

  const renderAdminActions = () => {
    const actions = [
      {
        key: 'delete',
        isDialog: true,
        label: 'Delete',
        icon: <TrashIcon className="h-4 w-4 mr-1" />,
        content: (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogDescription>Do you want to permanently delete this cast?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose>
                <Button
                  variant="destructive"
                  type="submit"
                  onClick={() => {
                    if (!selectedAccount) {
                      toastUnableToDeleteCast();
                      return;
                    }

                    removeCast(cast.hash, Number(selectedAccount.platformAccountId), selectedAccount.privateKey!).then(
                      () => {
                        toastSuccessCastDeleted(cast?.text);
                      }
                    );
                  }}
                >
                  Confirm
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        ),
      },
      {
        key: 'copy-cast-link',
        label: 'Copy cast link',
        icon: <DocumentDuplicateIcon className="h-4 w-4 mr-1" />,
        onClick: () => {
          const url = `${process.env.NEXT_PUBLIC_URL}/conversation/${cast.hash}`;
          addToClipboard(url);
          toastCopiedToClipboard(url);
        },
      },
      {
        key: 'copy-cast-hash',
        label: 'Copy cast hash',
        icon: <DocumentDuplicateIcon className="h-4 w-4 mr-1" />,
        onClick: () => {
          addToClipboard(cast.hash);
          toastCopiedToClipboard(cast.hash);
        },
      },
    ];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="ml-1">
          <Button size="icon" variant="outline" className="rounded-full h-6 w-6">
            <EllipsisHorizontalIcon className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <Dialog>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actions.map(({ key, label, icon, onClick, isDialog }) => {
              if (isDialog) {
                return (
                  <DialogTrigger key={`dialog-trigger-${key}`} asChild>
                    <DropdownMenuItem key={key} onSelect={(e) => e.preventDefault()}>
                      {icon}
                      {label}
                    </DropdownMenuItem>
                  </DialogTrigger>
                );
              }
              return (
                <DropdownMenuItem key={key} onClick={onClick}>
                  {icon}
                  {label}
                </DropdownMenuItem>
              );
            })}
            {actions.map(({ content }) => content)}
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const timeFormatting = useMemo(() => {
    if (!cast.timestamp) return null;

    return {
      timeAgoStr: formatDistanceToNowStrict(new Date(cast.timestamp), {
        addSuffix: false,
      }),
      fullTime: format(cast.timestamp, 'PPP HH:mm'),
    };
  }, [cast.timestamp]);

  const renderCastTime = () => {
    if (!timeFormatting) return null;

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <span className="text-sm leading-5 text-foreground/50 hover:underline">{timeFormatting.timeAgoStr}</span>
          </TooltipTrigger>
          <TooltipContent
            align={'center'}
            className="bg-popover border border-muted text-foreground/80 text-sm px-2 py-1"
            side="bottom"
          >
            {timeFormatting.fullTime}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderCastContent = () => (
    <div className="flex flex-col w-full max-w-2xl">
      <div
        className={cn(
          isEmbed ? 'p-2' : 'p-3',
          isEmbed && !hideReactions && 'pb-0',
          isSelected && isEmbed ? 'bg-muted' : 'cursor-pointer',
          isSelected ? 'bg-muted border-l-1 border-foreground/10' : 'border-l-1 border-transparent',
          'lg:ml-0 grow rounded-r-sm hover:bg-muted/50'
        )}
      >
        {renderRecastBadge()}
        {renderExternalUrlReply()}
        <div
          className={cn('flex items-start gap-x-2')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (onCastClick) {
              onCastClick();
            } else {
              onSelect && onSelect();
            }
          }}
        >
          {!isEmbed && !hideAuthor && (
            <Link href={`/profile/${authorInfo.username}`} prefetch={false} className="flex shrink-0">
              <Avatar className="relative h-10 w-10 mr-1">
                <AvatarImage src={authorInfo.pfpUrl} />
                <AvatarFallback>{authorInfo.username?.slice(0, 2)}</AvatarFallback>
              </Avatar>
            </Link>
          )}
          <div className="flex flex-col w-full space-y-1">
            <div className="flex flex-row flex-wrap justify-between gap-x-4 leading-5">
              <div className="flex flex-row">
                {hideAuthor ? (
                  <span className="text-sm leading-5 text-foreground/50">{authorInfo.username}</span>
                ) : (
                  <MemoizedProfileHoverCard fid={cast.author.fid} viewerFid={userFid} username={authorInfo.username}>
                    <span className="items-center flex font-semibold text-foreground truncate cursor-pointer w-full max-w-54 lg:max-w-full">
                      {isEmbed && (
                        <Avatar className="relative h-4 w-4 mr-1">
                          <AvatarImage src={authorInfo.pfpUrl} />
                          <AvatarFallback>{cast.author.username?.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      )}
                      {authorInfo.username}
                    </span>
                  </MemoizedProfileHoverCard>
                )}
                <div className="hidden lg:ml-2 lg:block">{renderChannelButton()}</div>
              </div>
              <div className="flex flex-row">
                <div className="block mr-2 lg:hidden">{renderChannelButton()}</div>
                {renderCastTime()}
                <Link
                  href={`${process.env.NEXT_PUBLIC_URL}/conversation/${cast.hash}`}
                  className="text-sm leading-5 text-foreground/50"
                  tabIndex={-1}
                  prefetch={false}
                >
                  <ArrowTopRightOnSquareIcon className="mt-0.5 w-4 h-4 ml-1.5" />
                </Link>
                {showAdminActions && renderAdminActions()}
              </div>
            </div>
            {showParentDetails && cast?.parent_hash && (
              <div className="flex flex-row items-center">
                <span className="text-sm text-foreground/50">{cast.parent_hash && 'Replying'}</span>
              </div>
            )}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onCastClick) {
                  onCastClick();
                } else {
                  onSelect && onSelect();
                }
              }}
              className="mt-2 w-full max-w-xl text-md text-foreground cursor-pointer break-words lg:break-normal"
              style={castTextStyle}
            >
              {processedText}
            </div>
            {!isEmbed && renderEmbeds()}
            {!hideReactions && renderCastReactions(cast as CastWithInteractions)}
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbed) {
    return (
      <Link href={`/conversation/${cast.hash}`} prefetch={false}>
        {renderCastContent()}
      </Link>
    );
  }

  return (
    <>
      {renderCastContent()}
      {'author' in cast && cast.author.fid && (
        <QuickListManageDialog
          open={isListDialogOpen}
          onOpenChange={setIsListDialogOpen}
          authorFid={cast.author.fid.toString()}
          authorUsername={cast.author.username || 'unknown'}
          authorDisplayName={cast.author.display_name || cast.author.username || 'Unknown'}
          authorAvatar={cast.author.pfp_url}
        />
      )}
    </>
  );
};

export const CastRow = React.memo(CastRowComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  // Avoid JSON.stringify for reactions - use targeted shallow comparisons instead
  const prevReactions = prevProps.cast.reactions;
  const nextReactions = nextProps.cast.reactions;

  return (
    prevProps.cast.hash === nextProps.cast.hash &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showChannel === nextProps.showChannel &&
    prevProps.isEmbed === nextProps.isEmbed &&
    prevProps.hideReactions === nextProps.hideReactions &&
    prevProps.recastedByFid === nextProps.recastedByFid &&
    // Targeted shallow comparisons for reaction counts
    prevReactions?.likes_count === nextReactions?.likes_count &&
    prevReactions?.recasts_count === nextReactions?.recasts_count &&
    prevReactions?.count === nextReactions?.count &&
    // Compare array lengths for viewer context changes
    prevReactions?.likes?.length === nextReactions?.likes?.length &&
    prevReactions?.recasts?.length === nextReactions?.recasts?.length
  );
});
