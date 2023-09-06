import React, { useState } from 'react';
import { toBytes } from 'viem'

import { castTextStyle, classNames } from "@/common/helpers/css";
import { CastType, CastReactionType } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { useAccountStore } from "@/stores/useAccountStore";
import { ArrowUturnUpIcon } from "@heroicons/react/20/solid";
import { ArrowPathRoundedSquareIcon, ArrowTopRightOnSquareIcon, ChatBubbleLeftIcon, HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartFilledIcon } from "@heroicons/react/24/solid";
import { ImgurImage } from "@/common/components/PostEmbeddedContent";
import { localize, timeDiff } from "../helpers/date";
import { publishReaction } from '../helpers/farcaster';
import { ReactionType } from '@farcaster/hub-web';
import includes from 'lodash.includes';
import map from 'lodash.map';
import { useHotkeys } from 'react-hotkeys-hook';
import * as Tooltip from '@radix-ui/react-tooltip';
import HotkeyTooltipWrapper from './HotkeyTooltipWrapper';

interface CastRowProps {
  cast: CastType;
  showChannel: boolean;
  channels: ChannelType[];
  onSelect?: () => void;
  isSelected?: boolean;
  showEmbed?: boolean;
  isThreadView?: boolean;
}

export const CastRow = ({ cast, isSelected, showChannel, onSelect, channels, showEmbed, isThreadView = false }: CastRowProps) => {
  if (isSelected) console.log(cast);

  const { accounts, selectedAccountIdx } = useAccountStore();
  const [didLike, setDidLike] = useState(false)
  const [didRecast, setDidRecast] = useState(false)

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount.platformAccountId);
  const authorFid = cast.author.fid;

  const embedUrl = cast.embeds.length > 0 ? cast.embeds[0].url : null;
  const isImageUrl = embedUrl ? embedUrl.endsWith('.gif') || embedUrl.endsWith('.png') || embedUrl.endsWith('.jpg') : false;
  const embedImageUrl = isImageUrl ? embedUrl : null;
  const now = new Date();

  useHotkeys('l', () => {
    if (isSelected) {
      publishReaction({ authorFid: userFid, privateKey: selectedAccount.privateKey, reactionBody: { type: ReactionType.LIKE, targetCastId: { fid: Number(authorFid), hash: toBytes(cast.hash) } } });
      setDidLike(true)
    }
  }, { enabled: isSelected }, [isSelected, selectedAccountIdx, authorFid, cast.hash]);

  useHotkeys('r', () => {
    if (isSelected) {
      publishReaction({ authorFid: userFid, privateKey: selectedAccount.privateKey, reactionBody: { type: ReactionType.RECAST, targetCastId: { fid: Number(authorFid), hash: toBytes(cast.hash) } } });
      setDidRecast(true);
    }
  }, { enabled: isSelected }, [isSelected, selectedAccountIdx, authorFid, cast.hash]);

  const getChannelForParentUrl = (parentUrl: string | null): ChannelType | undefined => parentUrl ?
    channels.find((channel) => channel.parent_url === parentUrl) : undefined;

  const getIconForCastReactionType = (reactionType: CastReactionType, isActive?: boolean): JSX.Element | undefined => {
    const className = classNames(isActive ? "text-gray-300" : "", "mt-0.5 w-4 h-4");
    switch (reactionType) {
      case CastReactionType.likes:
        return isActive ? <HeartFilledIcon className={className} aria-hidden="true" /> : <HeartIcon className={className} aria-hidden="true" />
      case CastReactionType.recasts:
        return <ArrowPathRoundedSquareIcon className={className} aria-hidden="true" />
      case CastReactionType.replies:
        return <ChatBubbleLeftIcon className={className} aria-hidden="true" />
      case CastReactionType.links:
        return <ArrowTopRightOnSquareIcon className={className} aria-hidden="true" />
      default:
        return undefined;
    }
  }

  const renderReaction = (key: string, count?: number | string, icon?: JSX.Element, isActive?: boolean) => {
    return (<div key={`cast-${cast.hash}-${key}`} className="mt-1.5 flex align-center text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-500 py-1 px-1.5 rounded-md"
      onClick={async (event) => {
        event.stopPropagation()
        if (key === 'recasts' || key === 'likes') {
          try {
            await publishReaction({ authorFid: userFid, privateKey: selectedAccount.privateKey, reactionBody: { type: key === 'likes' ? ReactionType.LIKE : ReactionType.RECAST, targetCastId: { fid: Number(authorFid), hash: toBytes(cast.hash) } } });
            if (key === 'likes') {
              setDidLike(true)
            } else {
              setDidRecast(true)
            }
          } catch (error) {
            console.error(`Error in publishReaction: ${error}`);
          }
        }
      }}>
      {icon || <span>{key}</span>}
      {count !== null && <span className="ml-1.5">{count}</span>}
    </div>)
  }

  const renderCastReactions = (cast: CastType) => {
    const repliesCount = cast.replies?.count || 0;
    const recastsCount = cast.reactions?.recasts?.length || cast.recasts?.count || 0;
    const likesCount = cast.reactions?.likes?.length || cast.reactions?.count || 0;

    const likeFids = cast.reactions?.fids || map(cast.reactions.likes, 'fid') || [];
    const recastFids = cast.recasts?.fids || map(cast.reactions.recasts, 'fid') || [];
    const reactions = {
      replies: { count: repliesCount },
      recasts: { count: recastsCount + Number(didRecast), isActive: didRecast || includes(recastFids, userFid) },
      likes: { count: likesCount + Number(didLike), isActive: didLike || includes(likeFids, userFid) },
    }
    const linksCount = cast.embeds.length;
    const isOnchainLink = linksCount ? cast.embeds[0].url.startsWith('"chain:') : false;
    return (<div className="flex space-x-6">
      {Object.entries(reactions).map(([key, reactionInfo]) => {
        const reaction = renderReaction(key, reactionInfo.count, getIconForCastReactionType(key as CastReactionType, reactionInfo?.isActive));
        if (key === 'likes' && isSelected) {
          return <Tooltip.Provider key={`cast-${cast.hash}-${key}-${reaction}`} delayDuration={50} skipDelayDuration={0}>
            <HotkeyTooltipWrapper hotkey="l (lowercase L)" side="bottom">
              {reaction}
            </HotkeyTooltipWrapper>
          </Tooltip.Provider>
        } else if (key === 'recasts' && isSelected) {
          return <Tooltip.Provider key={`cast-${cast.hash}-${key}-${reaction}`} delayDuration={50} skipDelayDuration={0}>
            <HotkeyTooltipWrapper hotkey="r" side="bottom">
              {reaction}
            </HotkeyTooltipWrapper>
          </Tooltip.Provider>
        } else {
          return reaction;
        }

      })}
      {linksCount && !isOnchainLink ? (
        <a href={cast.embeds[0].url} target="_blank" rel="noreferrer" className="cursor-pointer">
          {renderReaction('links', linksCount > 1 ? linksCount : undefined, getIconForCastReactionType(CastReactionType.links))}
        </a>) : null
      }
    </div>)
  }
  const channel = showChannel ? getChannelForParentUrl(cast.parent_url) : null;

  const authorPfpUrl = cast.author.pfp_url || cast.author.pfp?.url;
  const timeAgo = timeDiff(now, new Date(cast.timestamp))
  const timeAgoStr = localize(timeAgo[0], timeAgo[1]);

  return (<div className="flex grow">
    <div
      onClick={() => onSelect && onSelect()}
      className={classNames(
        isThreadView ? "" : "",
        isSelected ? "border-l border-gray-200 bg-gray-600" : "border-l border-gray-800 hover:bg-gray-700",
        "px-3 py-2 grow rounded-r-md cursor-pointer"
      )}>
      <div className="flex justify-between gap-x-4">
        <div className="flex flex-row py-1 leading-5 text-gray-300">
          {!isThreadView && (
            <img
              src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${authorPfpUrl}`}
              alt=""
              className="relative mt-0.5 mr-1.5 h-4 w-4 flex-none rounded-full bg-gray-50"
              referrerPolicy="no-referrer"
            />
          )}
          {cast.parent_hash && <ArrowUturnUpIcon className="w-4 h-4 text-gray-400" />}
          <span className="flex font-bold text-gray-100 truncate">@{cast.author.username} <span className="hidden md:ml-1 md:block">({cast.author.display_name || cast.author.displayName})</span></span>
          {showChannel && channel && (
            <div className="flex flex-row">
              <span className="ml-2 inline-flex items-center rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                {channel.name}
              </span>
            </div>
          )}
        </div>
        {cast.timestamp && (
          <span className="flex-none py-0.5 text-sm leading-5 text-gray-500">
            {timeAgoStr}
          </span>
        )}
      </div>
      <div className={classNames(isThreadView ? "ml-0.5" : "ml-6")}>
        <p className="text-sm text-gray-300 break-words lg:break-normal" style={castTextStyle}>
          {cast.text}
        </p>
        {embedImageUrl && (
          (isSelected || showEmbed) ? <ImgurImage url={embedImageUrl} /> : <span>🖼️</span>
        )}
        {renderCastReactions(cast)}
      </div>
    </div>
  </div>)
}
