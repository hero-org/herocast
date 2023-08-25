import { classNames } from "@/common/helpers/css";
import { CastType, CastReactionType } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { ArrowUturnUpIcon } from "@heroicons/react/20/solid";
import { ArrowPathRoundedSquareIcon, ChatBubbleLeftIcon, HeartIcon } from "@heroicons/react/24/solid";
import { ImgurImage } from "@/common/components/PostEmbeddedContent";

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

  const embedUrl = cast.embeds.length > 0 ? cast.embeds[0].url : null;
  const isImageUrl = embedUrl ? embedUrl.endsWith('.gif') || embedUrl.endsWith('.png') || embedUrl.endsWith('.jpg') : false;
  const embedImageUrl = isImageUrl ? embedUrl : null;

  const getChannelForParentUrl = (parentUrl: string | null): ChannelType | undefined => parentUrl ?
    channels.find((channel) => channel.parent_url === parentUrl) : undefined;

  const getIconForCastReactionType = (reactionType: CastReactionType): JSX.Element | null => {
    const className = "mt-0.5 w-4 h-4";
    switch (reactionType) {
      case CastReactionType.likes:
        return <HeartIcon className={className} aria-hidden="true" />
      case CastReactionType.recasts:
        return <ArrowPathRoundedSquareIcon className={className} aria-hidden="true" />
      case CastReactionType.replies:
        return <ChatBubbleLeftIcon className={className} aria-hidden="true" />
      default:
        return null;
    }
  }

  const renderReaction = (key: string, name: string, count: number, icon: JSX.Element | null) => (
    <div key={`cast-${cast.hash}-${key}`} className="mt-2 flex align-center text-sm text-gray-400 group-hover:text-gray-300 cursor-default">
      {icon || <span>{key}</span>}
      <span className="ml-1.5">{count}</span>
    </div>
  )

  const renderCastReactions = (cast: CastType) => {
    const likesCount = cast.reactions?.likes?.length || cast.reactions?.count;
    const recastsCount = cast.reactions?.recasts?.length || cast.recasts?.count;
    const repliesCount = cast.replies?.count;
    const reactions = {
      replies: repliesCount,
      recasts: recastsCount,
      likes: likesCount,
    }
    return (<div className="flex space-x-6">
      {Object.entries(reactions).map(([key, count]) => {
        return count > 0 && renderReaction(key, cast.reactions[key], count, getIconForCastReactionType(key as CastReactionType));
      })}
    </div>)
  }
  const channel = showChannel ? getChannelForParentUrl(cast.parent_url) : null;

  const authorPfpUrl = cast.author.pfp_url || cast.author.pfp?.url;
  return (<div className="flex grow">
    <div
      onClick={() => onSelect && onSelect()}
      className={classNames(
        isSelected ? "px-2 -ml-2 bg-gray-700 border-l border-gray-200" : "",
        "py-1 grow rounded-r-md cursor-pointer"
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
          <span className="flex font-bold text-gray-100">@{cast.author.username} <span className="hidden md:ml-1 md:block">({cast.author.display_name || cast.author.displayName})</span></span>
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
            {new Date(cast.timestamp).toLocaleString()}
          </span>
        )}
      </div>
      <div className={classNames(isThreadView ? "ml-0.5" : "ml-6")}>
        <p className="text-sm text-gray-300 break-words lg:break-normal">
          {cast.text !== embedUrl && cast.text}
        </p>
        {embedImageUrl && (
          (isSelected || showEmbed) ? <ImgurImage url={embedImageUrl} /> : <span>🖼️</span>
        )}
        {renderCastReactions(cast)}
      </div>
    </div>
  </div>)
}
