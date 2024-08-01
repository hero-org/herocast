import React, { useState } from "react";
import { castTextStyle, classNames } from "@/common/helpers/css";
import { CastReactionType } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  ArrowPathRoundedSquareIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
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
import { CastModalView, useNavigationStore } from "@/stores/useNavigationStore";
import { useDataStore } from "@/stores/useDataStore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDraftStore } from "@/stores/useDraftStore";
import ChannelHoverCard from "./ChannelHoverCard";

registerPlugin("mention", mentionPlugin);
registerPlugin("cashtag", cashtagPlugin);
registerPlugin("channel", channelPlugin);

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
        window.open(href, "_blank");
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

const MemoizedProfileHoverCard = React.memo(ProfileHoverCard);

export const CastRow = ({
  cast,
  isSelected,
  showChannel,
  onSelect,
  isEmbed = false,
  isThreadView = false,
  hideReactions = false,
}: CastRowProps) => {
  const {
    accounts,
    selectedAccountIdx,
    allChannels: channels,
    setSelectedChannelByName,
    setSelectedChannelUrl,
  } = useAccountStore();

  const { setCastModalDraftId, setCastModalView, openNewCastModal } =
    useNavigationStore();
  const { addNewPostDraft } = useDraftStore();
  const { updateSelectedCast } = useDataStore();

  const [didLike, setDidLike] = useState(false);
  const [didRecast, setDidRecast] = useState(false);

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);
  const authorFid = cast?.author.fid;
  const canSendReaction =
    selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;
  const now = new Date();

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
    const recastsCount =
      cast.reactions?.recasts_count || cast.recasts?.count || 0;
    const likesCount =
      cast.reactions?.likes_count || cast.reactions?.count || 0;

    const likeFids = map(cast.reactions?.likes, "fid") || [];
    const recastFids = map(cast.reactions?.recasts, "fid") || [];
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
      case CastReactionType.quote:
        return (
          <ChatBubbleLeftRightIcon className={className} aria-hidden="true" />
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

  const renderCastReactions = (cast: CastWithInteractions) => {
    const linksCount = cast?.embeds ? cast.embeds.length : 0;
    const isOnchainLink =
      linksCount > 0 && "url" in cast.embeds[0]
        ? cast.embeds[0].url.startsWith("chain:")
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
                href={"url" in cast.embeds[0] ? cast.embeds[0].url : "#"}
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
        <Tooltip.Provider
          key={`cast-${cast.hash}-quote`}
          delayDuration={50}
          skipDelayDuration={0}
        >
          <HotkeyTooltipWrapper hotkey="Q" side="bottom">
            {renderReaction(
              CastReactionType.quote,
              true,
              undefined,
              getIconForCastReactionType(CastReactionType.quote)
            )}
          </HotkeyTooltipWrapper>
        </Tooltip.Provider>
      </div>
    );
  };

  const getText = () =>
    "text" in cast && cast.text ? (
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

  const renderEmbeds = () => {
    if (!("embeds" in cast) || !cast.embeds.length) {
      return null;
    }

    const embedsContainsCastEmbed = cast.embeds.some((c) => c.cast_id);
    return (
      <div
        className={cn(
          cast.embeds?.length > 1 &&
            !embedsContainsCastEmbed &&
            "grid lg:grid-cols-2 gap-4",
          "w-full self-start"
        )}
        onClick={(e) => e.preventDefault()}
      >
        <ErrorBoundary>
          {map(cast.embeds, (embed) => (
            <div
              key={`${cast.hash}-embed-${embed?.cast_id?.hash || embed?.url}`}
            >
              {renderEmbedForUrl(embed)}
            </div>
          ))}
        </ErrorBoundary>
      </div>
    );
  };

  const renderRecastBadge = () => {
    const shouldShowBadge =
      "inclusion_context" in cast &&
      cast.inclusion_context?.is_following_recaster &&
      !cast.inclusion_context?.is_following_author;

    if (!shouldShowBadge) return null;
    return (
      <span className="h-5 ml-2 inline-flex truncate items-top rounded-sm bg-gray-400/10 px-1.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-400/30">
        <ArrowPathRoundedSquareIcon className="h-4 w-4" />
      </span>
    );
  };

  const channel =
    showChannel && "parent_url" in cast
      ? getChannelForParentUrl(cast.parent_url)
      : null;
  const timeAgo =
    "timestamp" in cast
      ? timeDiff(now, new Date(cast.timestamp))
      : [0, "seconds"];
  const timeAgoStr = localize(Number(timeAgo[0]), timeAgo[1].toString());
  const pfpUrl = cast.author.pfp_url || cast.author?.pfp?.url;
  const displayName = cast.author.display_name || cast.author.displayName;

  const renderChannelButton = () =>
    showChannel &&
    channel && (
      <Button
        variant="outline"
        onClick={() => setSelectedChannelUrl(channel.url)}
        className="h-5 inline-flex truncate items-top rounded-sm bg-blue-400/10  hover:bg-blue-400/20 px-1.5 py-0.5 text-xs font-medium text-blue-400 hover:text-blue-600 ring-1 ring-inset ring-blue-400/30 border-none"
      >
        {channel.name}
      </Button>
    );

  return (
    <div className="flex min-w-full w-full max-w-2xl">
      <div
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          event.stopPropagation();
          onSelect && onSelect();
        }}
        className={classNames(
          "p-3",
          isSelected ? "bg-muted" : "cursor-pointer",
          isSelected
            ? "border-l-1 border-foreground/10"
            : "border-l-1 border-transparent",
          "lg:ml-0 grow rounded-r-sm"
        )}
      >
        {isThreadView && (
          <div className="absolute bg-foreground/10 -ml-3 mt-[1.2rem] h-[1.5px] w-6" />
        )}
        <div className="flex items-top gap-x-4">
          {!isEmbed && (
            <Link href={`/profile/${cast.author.username}`} prefetch={false}>
              <img
                className="relative h-10 w-10 flex-none bg-background rounded-full"
                src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${pfpUrl}`}
              />
            </Link>
          )}
          <div className="flex flex-col w-full">
            <div className="flex flex-row flex-wrap justify-between gap-x-4 leading-5">
              <div className="flex flex-row">
                <MemoizedProfileHoverCard
                  fid={cast.author.fid}
                  viewerFid={userFid}
                  username={cast.author.username}
                >
                  <span className="items-center flex font-semibold text-foreground/80 truncate cursor-pointer w-full max-w-54 lg:max-w-full">
                    {isEmbed && (
                      <img
                        className="relative h-4 w-4 mr-1 flex-none bg-background rounded-full"
                        src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${pfpUrl}`}
                      />
                    )}
                    {displayName}
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
                </MemoizedProfileHoverCard>
                <div className="hidden lg:ml-2 lg:block">
                  {renderChannelButton()}
                </div>
                {renderRecastBadge()}
              </div>
              <div className="flex flex-row">
                <div className="block mr-2 lg:hidden">
                  {renderChannelButton()}
                </div>
                {"timestamp" in cast && cast.timestamp && (
                  <span className="text-sm leading-5 text-foreground/50">
                    {timeAgoStr}
                  </span>
                )}
                <Link
                  href={`${process.env.NEXT_PUBLIC_URL}/conversation/${cast.hash}`}
                  className="text-sm leading-5 text-foreground/50"
                  tabIndex={-1}
                  prefetch={false}
                >
                  <ArrowTopRightOnSquareIcon className="mt-0.5 w-4 h-4 ml-1.5" />
                </Link>
              </div>
            </div>
            <div
              onClick={() => onSelect && onSelect()}
              className="w-full max-w-xl text-md text-foreground cursor-pointer break-words lg:break-normal"
              style={castTextStyle}
            >
              {getText()}
            </div>
            {!hideReactions &&
              renderCastReactions(cast as CastWithInteractions)}
            {!isEmbed && renderEmbeds()}
          </div>
        </div>
      </div>
    </div>
  );
};
