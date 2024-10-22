import React, { useState } from 'react';
import { castTextStyle } from '@/common/helpers/css';
import { CastReactionType } from '@/common/constants/farcaster';
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
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartFilledIcon } from '@heroicons/react/24/solid';
import { publishReaction, removeCast, removeReaction } from '../helpers/farcaster';
import includes from 'lodash.includes';
import map from 'lodash.map';
import { useHotkeys } from 'react-hotkeys-hook';
import HotkeyTooltipWrapper from './HotkeyTooltipWrapper';
import get from 'lodash.get';
import Linkify from 'linkify-react';
import { ErrorBoundary } from '@sentry/react';
import { renderEmbedForUrl } from './Embeds';
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
import ChannelHoverCard from './ChannelHoverCard';
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
import { getProfile } from '../helpers/profileUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

registerPlugin('mention', mentionPlugin);
registerPlugin('cashtag', cashtagPlugin);
registerPlugin('channel', channelPlugin);

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
    <ChannelHoverCard channelName={content}>
      <span
        className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
        onClick={(event) => {
          event.stopPropagation();
        }}
        rel="noopener noreferrer"
      >
        {content}
      </span>
    </ChannelHoverCard>
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

export const CastRow = ({
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
}: CastRowProps) => {
  const {
    accounts,
    selectedAccountIdx,
    allChannels: channels,
    setSelectedChannelByName,
    setSelectedChannelUrl,
  } = useAccountStore();

  const { setCastModalDraftId, setCastModalView, openNewCastModal } = useNavigationStore();
  const { addNewPostDraft } = useDraftStore();
  const { updateSelectedCast } = useDataStore();

  const [didLike, setDidLike] = useState(false);
  const [didRecast, setDidRecast] = useState(false);

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);
  const authorFid = cast?.author.fid;
  const canSendReaction = selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;

  const onReply = () => {
    setCastModalView(CastModalView.Reply);
    updateSelectedCast(cast);
    addNewPostDraft({
      parentCastId: {
        hash: cast.hash,
        fid: cast.author.fid.toString(),
      },
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
          castId: {
            hash: cast.hash,
            fid: cast.author.fid.toString(),
          },
        },
      ],
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  };

  const getCastReactionsObj = () => {
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
  };

  const reactions = getCastReactionsObj();

  useHotkeys(
    'l',
    () => {
      if (isSelected) {
        onClickReaction(CastReactionType.likes, reactions[CastReactionType.likes].isActive);
      }
    },
    { enabled: isSelected },
    [isSelected, selectedAccountIdx, authorFid, cast?.hash, reactions?.likes]
  );

  useHotkeys(
    'shift+r',
    () => {
      if (isSelected) {
        onClickReaction(CastReactionType.recasts, reactions[CastReactionType.recasts].isActive);
      }
    },
    { enabled: isSelected },
    [isSelected, selectedAccountIdx, authorFid, cast.hash, reactions?.recasts]
  );

  const getChannelForParentUrl = (parentUrl: string | null): ChannelType | undefined =>
    parentUrl ? channels.find((channel) => channel.url === parentUrl) : undefined;

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

    if (key === CastReactionType.likes) {
      setDidLike(!isActive);
    } else if (key === CastReactionType.recasts) {
      setDidRecast(!isActive);
    }

    if (!canSendReaction) {
      toastInfoReadOnlyMode();
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

      const reactionBodyType: 'like' | 'recast' = key === CastReactionType.likes ? 'like' : 'recast';
      const reaction = {
        type: reactionBodyType,
        target: { fid: Number(authorFid), hash: cast.hash },
      };
      if (isActive) {
        await removeReaction({
          authorFid: userFid,
          privateKey: selectedAccount.privateKey!,
          reaction,
        });
      } else {
        await publishReaction({
          authorFid: userFid,
          privateKey: selectedAccount.privateKey!,
          reaction,
        });
      }
    } catch (error) {
      console.error(`Error in onClickReaction: ${error}`);
    }
  };

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

  const getText = () =>
    'text' in cast && cast.text ? (
      <ErrorBoundary>
        <Linkify
          as="span"
          options={{
            ...linkifyOptions,
            attributes: { userFid, setSelectedChannelByName },
          }}
        >
          {cast.text}{' '}
        </Linkify>
      </ErrorBoundary>
    ) : null;

  const renderEmbeds = () => {
    if (!('embeds' in cast) || !cast.embeds.length) {
      return null;
    }

    const embedsContainsCastEmbed = cast.embeds.some((c) => c.cast_id);
    return (
      <div
        className={cn(
          cast.embeds?.length > 1 && !embedsContainsCastEmbed && 'grid lg:grid-cols-2 gap-4',
          'max-w-lg self-start'
        )}
        onClick={(e) => e.preventDefault()}
      >
        <ErrorBoundary>
          {map(cast.embeds, (embed) => (
            <div key={`${cast.hash}-embed-${embed?.cast_id?.hash || embed?.url}`}>
              {renderEmbedForUrl({ ...embed, hideReactions })}
            </div>
          ))}
        </ErrorBoundary>
      </div>
    );
  };

  const renderRecastBadge = () => {
    const shouldShowBadge =
      'inclusion_context' in cast &&
      cast.inclusion_context?.is_following_recaster &&
      !cast.inclusion_context?.is_following_author;

    if (!recastedByFid && !shouldShowBadge) return null;

    let recaster;
    if (recastedByFid) {
      recaster = getProfile(useDataStore.getState(), undefined, recastedByFid.toString());
    } else {
      recaster = cast.reactions?.recasts?.find((recast) => recast?.viewer_context?.following === true);
    }
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

  const channel = showChannel && 'parent_url' in cast ? getChannelForParentUrl(cast.parent_url) : null;
  const pfpUrl = cast.author.pfp_url || cast.author?.pfp?.url || cast.author?.avatar_url;
  const username = cast.author.username || cast.author.fname;
  const displayName = cast.author.display_name || cast.author.displayName;

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

  const renderCastTime = () => {
    if (!cast.timestamp) return null;

    const timeAgoStr = formatDistanceToNowStrict(new Date(cast.timestamp), {
      addSuffix: false,
    });

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger>
            <span className="text-sm leading-5 text-foreground/50 hover:underline">{timeAgoStr}</span>
          </TooltipTrigger>
          <TooltipContent
            align={'center'}
            className="bg-popover border border-muted text-foreground/80 text-sm px-2 py-1"
            side="bottom"
          >
            {format(cast.timestamp, 'PPP HH:mm')}
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
        {isThreadView && <div className="absolute bg-foreground/10 -ml-3 mt-[1.2rem] h-[1.5px] w-6" />}
        <div
          className={cn('flex items-top gap-x-4')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect && onSelect();
          }}
        >
          {!isEmbed && !hideAuthor && (
            <Link href={`/profile/${username}`} prefetch={false} className="flex shrink-0">
              <Avatar className="relative h-10 w-10 mr-1">
                <AvatarImage src={pfpUrl} />
                <AvatarFallback>{username?.slice(0, 2)}</AvatarFallback>
              </Avatar>
            </Link>
          )}
          <div className="flex flex-col w-full space-y-1">
            <div className="flex flex-row flex-wrap justify-between gap-x-4 leading-5">
              <div className="flex flex-row">
                {hideAuthor ? (
                  <span className="text-sm leading-5 text-foreground/50">@{username}</span>
                ) : (
                  <MemoizedProfileHoverCard fid={cast.author.fid} viewerFid={userFid} username={username}>
                    <span className="items-center flex font-semibold text-foreground truncate cursor-pointer w-full max-w-54 lg:max-w-full">
                      {isEmbed && (
                        <Avatar className="relative h-4 w-4 mr-1">
                          <AvatarImage src={pfpUrl} />
                          <AvatarFallback>{cast.author.username?.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      )}
                      {displayName}
                      <span className="hidden text-muted-foreground font-normal lg:ml-1 lg:block">@{username}</span>
                      <span>
                        {cast.author.power_badge && (
                          <img
                            src="/images/ActiveBadge.webp"
                            className="ml-1 mt-0.5 h-[14px] w-[14px]"
                            alt="power badge"
                          />
                        )}
                      </span>
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
              onClick={() => onSelect && onSelect()}
              className="mt-2 w-full max-w-xl text-md text-foreground cursor-pointer break-words lg:break-normal"
              style={castTextStyle}
            >
              {getText()}
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

  return renderCastContent();
};
