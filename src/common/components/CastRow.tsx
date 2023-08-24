import { classNames } from "@/common/helpers/css";
import { CastType, CastReactionType } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { ArrowUturnUpIcon } from "@heroicons/react/20/solid";
import { ArrowPathRoundedSquareIcon, ArrowTopRightOnSquareIcon, ChatBubbleLeftIcon, HeartIcon } from "@heroicons/react/24/solid";
import { ImgurImage } from "@/common/components/PostEmbeddedContent";

interface CastRowProps {
  cast: CastType;
  showChannel: boolean;
  channels: ChannelType[];
  onSelect?: () => void;
  isSelected?: boolean;
  showEmbed?: boolean;
}

export const CastRow = ({ cast, isSelected, showChannel, onSelect, channels, showEmbed }: CastRowProps) => {
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
    return (<div className="flex space-x-6">
      {cast.replies.count > 0 && renderReaction(`cast-${cast.hash}-replies`, "replies", cast.replies.count, getIconForCastReactionType(CastReactionType.replies))}
      {Object.entries(cast.reactions).map(([key, value]) => {
        const count = (value as []).length;
        const icon = getIconForCastReactionType(key as CastReactionType);

        return count > 0 && renderReaction(key, cast.reactions[key], count, icon);
        {/* (
          <div key={`cast-${cast.hash}-${key}`} className="mt-2 flex align-center text-sm text-gray-400 group-hover:text-gray-300 cursor-default">
            {icon || <span>{key}</span>}
            <span className="ml-1.5">{count}</span>
          </div>
        ) */}
      })}
    </div>)
  }
  const channel = showChannel ? getChannelForParentUrl(cast.parent_url) : null;

  const authorPfpUrl = cast.author.pfp_url || cast.author.pfp?.url;
  return (<div className="flex grow">
    <div
      onClick={() => onSelect && onSelect()}
      className={classNames(
        isSelected ? "bg-gray-700 border-l border-gray-200" : "",
        "grow rounded-r-sm py-2 px-4 cursor-pointer"
      )}>
      <div className="flex justify-between gap-x-4">
        <div className="flex flex-row py-0.5 text-xs leading-5 text-gray-300">
          <img
            src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${authorPfpUrl}`}
            alt=""
            className="relative mr-1.5 h-5 w-5 flex-none rounded-full bg-gray-50"
            referrerPolicy="no-referrer"
          />
          {cast.parent_hash && <ArrowUturnUpIcon className="w-4 h-4 text-gray-400" />}
          <span className="flex font-medium text-gray-100">@{cast.author.username} <span className="hidden md:ml-1 md:block">({cast.author.display_name || cast.author.displayName})</span></span>
          {showChannel && channel && (
            <div className="flex flex-row">
              <span className="ml-2 inline-flex items-center rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                {channel.name}
              </span>
            </div>
          )}
        </div>
        {cast.timestamp && (
          <span className="flex-none py-0.5 text-xs leading-5 text-gray-500">
            {new Date(cast.timestamp).toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-300 break-words lg:break-normal">
        {cast.text !== embedUrl && cast.text}
        {embedUrl && !isImageUrl && cast.text !== embedUrl && (
          <span className="mt-3 flex text-sm text-gray-500">{embedUrl}<ArrowTopRightOnSquareIcon className="ml-1.5 mt-0.5 h-4 w-4" /></span>
        )}
      </p>
      {embedImageUrl && (
        (isSelected || showEmbed) ? <ImgurImage url={embedImageUrl} /> : <span>🖼️</span>
      )}
      {renderCastReactions(cast)}
    </div>
  </div>)
}
