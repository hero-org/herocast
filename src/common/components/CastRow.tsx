import React, { useState } from "react";
import { castTextStyle, classNames } from "../../../src/common/helpers/css";
import {
  CastType,
  CastReactionType,
} from "../../../src/common/constants/farcaster";
import { ChannelType } from "../../../src/common/constants/channels";
import { useAccountStore } from "../../../src/stores/useAccountStore";
import {
  ArrowPathRoundedSquareIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartFilledIcon } from "@heroicons/react/24/solid";
import { localize, timeDiff } from "../helpers/date";
import { publishReaction, removeReaction } from "../helpers/farcaster";
import includes from "lodash.includes";
import map from "lodash.map";
import { useHotkeys } from "react-hotkeys-hook";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "./HotkeyTooltipWrapper";
import get from "lodash.get";
import Linkify from "linkify-react";
import { ErrorBoundary } from "@sentry/react";
import { renderEmbedForUrl } from "./Embeds";
import ProfileHoverCard from "./ProfileHoverCard";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { registerPlugin } from "linkifyjs";
import CashtagHoverCard from "./CashtagHoverCard";
import mentionPlugin, {
  cashtagPlugin,
  channelPlugin,
} from "../helpers/linkify";
import { AccountPlatformType } from "../constants/accounts";
import { toastInfoReadOnlyMode } from "../helpers/toast";

registerPlugin("mention", mentionPlugin);
registerPlugin("cashtag", cashtagPlugin);
registerPlugin("channel", channelPlugin);

interface CastRowProps {
  cast: CastWithInteractions;
  showChannel?: boolean;
  onSelect?: () => void;
  onReply?: () => void;
  isSelected?: boolean;
  isThreadView?: boolean;
  disableEmbeds?: boolean;
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
      <ProfileHoverCard username={content.slice(1)} viewerFid={userFid}>
        {content}
      </ProfileHoverCard>
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
        window.open(href, "_blank");
      }}
      rel="noopener noreferrer"
    >
      {content}
    </span>
  );
};

const renderChannel = ({ attributes, content }) => {
  const { href, setSelectedChannelByName } = attributes;
  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
        setSelectedChannelByName(href);
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
  if (tokenSymbol === "usd") return null;

  const { userFid } = attributes;

  return (
    <span
      className="cursor-pointer text-blue-500 text-font-medium hover:underline hover:text-blue-500/70"
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
    >
      <CashtagHoverCard
        tokenSymbol={tokenSymbol.toUpperCase()}
        userFid={userFid}
      >
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

export const CastRow = ({
  cast,
  isSelected,
  showChannel,
  onSelect,
  onReply,
  disableEmbeds = false,
  isThreadView = false,
}: CastRowProps) => {
  const {
    accounts,
    selectedAccountIdx,
    allChannels: channels,
    setSelectedChannelByName,
  } = useAccountStore();

  const [didLike, setDidLike] = useState(false);
  const [didRecast, setDidRecast] = useState(false);

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);
  const authorFid = cast?.author.fid;
  const canSendReaction =
    selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;
  const now = new Date();

  const getCastReactionsObj = () => {
    const repliesCount = cast.replies?.count || 0;
    const recastsCount =
      cast.reactions?.recasts?.length || cast.recasts?.count || 0;
    const likesCount =
      cast.reactions?.likes?.length || cast.reactions?.count || 0;

    const likeFids =
      cast.reactions?.fids || map(cast.reactions?.likes, "fid") || [];
    const recastFids =
      cast.recasts?.fids || map(cast.reactions?.recasts, "fid") || [];
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
    "l",
    () => {
      if (isSelected) {
        onClickReaction(
          CastReactionType.likes,
          reactions[CastReactionType.likes].isActive
        );
      }
    },
    { enabled: isSelected },
    [isSelected, selectedAccountIdx, authorFid, cast?.hash, reactions?.likes]
  );

  useHotkeys(
    "shift+r",
    () => {
      if (isSelected) {
        onClickReaction(
          CastReactionType.recasts,
          reactions[CastReactionType.recasts].isActive
        );
      }
    },
    { enabled: isSelected },
    [isSelected, selectedAccountIdx, authorFid, cast.hash, reactions?.recasts]
  );

  const getChannelForParentUrl = (
    parentUrl: string | null
  ): ChannelType | undefined =>
    parentUrl
      ? channels.find((channel) => channel.url === parentUrl)
      : undefined;

  const getIconForCastReactionType = (
    reactionType: CastReactionType,
    isActive?: boolean
  ): JSX.Element | undefined => {
    const className = classNames(
      isActive ? "text-foreground/70" : "",
      "mt-0.5 w-4 h-4 mr-1"
    );

    switch (reactionType) {
      case CastReactionType.likes:
        return isActive ? (
          <HeartFilledIcon className={className} aria-hidden="true" />
        ) : (
          <HeartIcon className={className} aria-hidden="true" />
        );
      case CastReactionType.recasts:
        return (
          <ArrowPathRoundedSquareIcon
            className={className}
            aria-hidden="true"
          />
        );
      case CastReactionType.replies:
        return <ChatBubbleLeftIcon className={className} aria-hidden="true" />;
      case CastReactionType.links:
        return (
          <ArrowTopRightOnSquareIcon className={className} aria-hidden="true" />
        );
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
    } else {
      setDidRecast(!isActive);
    }

    if (!canSendReaction) {
      toastInfoReadOnlyMode();
      return;
    }

    try {
      if (key === CastReactionType.replies) {
        onReply?.();
        return;
      }
      const reactionBodyType: "like" | "recast" =
        key === CastReactionType.likes ? "like" : "recast";
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

  const renderReaction = (
    key: CastReactionType,
    isActive: boolean,
    count?: number | string,
    icon?: JSX.Element
  ) => {
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

  const renderCastReactions = (cast: CastType) => {
    const linksCount = cast?.embeds ? cast.embeds.length : 0;
    const isOnchainLink =
      linksCount > 0 && cast.embeds[0].url
        ? cast.embeds[0].url.startsWith('"chain:')
        : false;

    return (
      <div className="-ml-1.5 flex space-x-3">
        {Object.entries(reactions).map(([key, reactionInfo]) => {
          const isActive = get(reactionInfo, "isActive", false);
          const icon = getIconForCastReactionType(
            key as CastReactionType,
            isActive
          );
          const reaction = renderReaction(
            key as CastReactionType,
            isActive,
            reactionInfo.count,
            icon
          );

          if (key === "likes" && isSelected) {
            return (
              <Tooltip.Provider
                key={`cast-${cast.hash}-${key}-${reaction}`}
                delayDuration={50}
                skipDelayDuration={0}
              >
                <HotkeyTooltipWrapper hotkey="L" side="bottom">
                  {reaction}
                </HotkeyTooltipWrapper>
              </Tooltip.Provider>
            );
          } else if (key === "recasts" && isSelected) {
            return (
              <Tooltip.Provider
                key={`cast-${cast.hash}-${key}-${reaction}`}
                delayDuration={50}
                skipDelayDuration={0}
              >
                <HotkeyTooltipWrapper hotkey="Shift + R" side="bottom">
                  {reaction}
                </HotkeyTooltipWrapper>
              </Tooltip.Provider>
            );
          } else if (key === "replies" && isSelected) {
            return (
              <Tooltip.Provider
                key={`cast-${cast.hash}-${key}-${reaction}`}
                delayDuration={50}
                skipDelayDuration={0}
              >
                <HotkeyTooltipWrapper hotkey="R" side="bottom">
                  {reaction}
                </HotkeyTooltipWrapper>
              </Tooltip.Provider>
            );
          } else {
            return reaction;
          }
        })}
        {linksCount && !isOnchainLink ? (
          <Tooltip.Provider
            key={`cast-${cast.hash}-link`}
            delayDuration={50}
            skipDelayDuration={0}
          >
            <HotkeyTooltipWrapper hotkey="O" side="bottom">
              <a
                tabIndex={-1}
                href={cast.embeds[0].url}
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
          </Tooltip.Provider>
        ) : null}
      </div>
    );
  };

  const getText = () =>
    cast.text ? (
      <ErrorBoundary>
        <Linkify
          as="span"
          options={{
            ...linkifyOptions,
            attributes: { userFid, setSelectedChannelByName },
          }}
        >
          {cast.text}{" "}
        </Linkify>
      </ErrorBoundary>
    ) : null;

  const renderEmbeds = () =>
    cast.embeds &&
    cast.embeds.length > 0 && (
      <div className="mt-4">
        <ErrorBoundary>
          {map(cast.embeds, (embed) => (
            <div key={`${cast.hash}-embed-${embed.url}`}>
              {renderEmbedForUrl(embed)}
            </div>
          ))}
        </ErrorBoundary>
      </div>
    );

  const renderRecastBadge = () => {
    const shouldShowBadge =
      cast?.inclusion_context &&
      cast?.inclusion_context?.is_following_recaster &&
      !cast?.inclusion_context?.is_following_author;

    if (!shouldShowBadge) return null;
    return (
      <span className="h-5 ml-2 inline-flex truncate items-top rounded-sm bg-gray-400/10 px-1.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-400/30">
        <ArrowPathRoundedSquareIcon className="h-4 w-4" />
      </span>
    );
  };

  const channel = showChannel ? getChannelForParentUrl(cast.parent_url) : null;
  const authorPfpUrl = cast.author.pfp_url || cast.author.pfp?.url;
  const timeAgo = timeDiff(now, new Date(cast.timestamp));
  const timeAgoStr = localize(timeAgo[0], timeAgo[1]);

  return (
    <div className="flex min-w-full w-full max-w-2xl">
      <div
        onClick={() => onSelect && onSelect()}
        className={classNames(
          "py-4 px-2",
          isSelected ? "bg-foreground/10" : "cursor-pointer",
          isSelected
            ? "border-l-1 border-foreground/10"
            : "border-l-1 border-transparent",
          "lg:ml-0 grow rounded-r-sm"
        )}
      >
        {isThreadView && <div className="absolute bg-foreground/10 -ml-2 mt-[1.2rem] h-[1.5px] w-4" />}
        <div className="flex items-top gap-x-4">
          <img
            className="relative h-10 w-10 flex-none bg-background rounded-full"
            src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${authorPfpUrl}`}
          />
          <div className="flex flex-col w-full">
            <div className="flex flex-row justify-between gap-x-4 leading-5">
              <div className="flex flex-row">
                <ProfileHoverCard fid={cast.author.fid} viewerFid={userFid}>
                  <span className="flex font-semibold text-foreground/80 truncate cursor-pointer w-full max-w-54 lg:max-w-full">
                    {cast.author.display_name || cast.author.displayName}
                    <span className="hidden font-normal lg:ml-1 lg:block">
                      (@{cast.author.username})
                    </span>
                    <span>
                      {cast.author.power_badge && (
                        <img
                          src="/images/ActiveBadge.webp"
                          className="ml-2 mt-0.5 h-[17px] w-[17px]"
                          alt="power badge"
                        />
                      )}
                    </span>
                  </span>
                </ProfileHoverCard>
                {showChannel && channel && (
                  <span className="h-5 ml-2 inline-flex truncate items-top rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                    {channel.name}
                  </span>
                )}
                {renderRecastBadge()}
              </div>
              <div className="flex flex-row">
                {cast.timestamp && (
                  <span className="text-sm leading-5 text-foreground/50">
                    {timeAgoStr}
                  </span>
                )}
                <a
                  href={`${process.env.NEXT_PUBLIC_URL}/cast/${cast.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm leading-5 text-foreground/50"
                  tabIndex={-1}
                >
                  <ArrowTopRightOnSquareIcon className="mt-0.5 w-4 h-4 ml-1.5" />
                </a>
              </div>
            </div>
            <div className="">
              <div
                className="mt-2 w-full max-w-xl text-md text-foreground break-words lg:break-normal"
                style={castTextStyle}
              >
                {getText()}
              </div>
            </div>
            {renderCastReactions(cast)}
            {!disableEmbeds && renderEmbeds()}
          </div>
        </div>
      </div>
    </div>
  );
};
