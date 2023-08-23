import { classNames } from "@/common/helpers/css";
import { CastType, CastReactionType } from "@/common/constants/farcaster";
import { ChannelType } from "@/common/constants/channels";
import { ArrowUturnUpIcon } from "@heroicons/react/20/solid";
import { ArrowPathRoundedSquareIcon, HeartIcon } from "@heroicons/react/24/solid";
import { ImgurImage } from "@/common/components/PostEmbeddedContent";

interface CastRowProps {
  cast: CastType;
  isSelected: boolean;
  showChannel: boolean;
  onSelect: () => void;
  channels: ChannelType[];
}

export const CastRow = ({ cast, isSelected, showChannel, onSelect, channels }: CastRowProps) => {
  const embedUrl = cast.embeds.length > 0 ? cast.embeds[0].url : null;
  const embedImageUrl = embedUrl?.endsWith('.png') || embedUrl?.endsWith('.jpg') ? embedUrl : null;

  const getChannelForParentUrl = (parentUrl: string | null): ChannelType | undefined => parentUrl ?
    channels.find((channel) => channel.parent_url === parentUrl) : undefined;

  const getIconForCastReactionType = (reactionType: CastReactionType): JSX.Element | null => {
    const className = "mt-0.5 w-4 h-4";
    switch (reactionType) {
      case CastReactionType.likes:
        return <HeartIcon className={className} aria-hidden="true" />
      case CastReactionType.recasts:
        return <ArrowPathRoundedSquareIcon className={className} aria-hidden="true" />
      default:
        return null;
    }
  }

  const renderCastReactions = (cast: CastType) => {
    return (<div className="flex space-x-6">
      {Object.entries(cast.reactions).map(([key, value]) => {
        const count = (value as []).length;
        const icon = getIconForCastReactionType(key as CastReactionType);

        return count > 0 && (
          <div key={`cast-${cast.hash}-${key}`} className="mt-2 flex align-center text-sm text-gray-400 group-hover:text-gray-300 cursor-default">
            {icon || <span>{key}</span>}
            <span className="ml-1.5">{count}</span>
          </div>
        )
      })}
    </div>)
  }
  const channel = showChannel ? getChannelForParentUrl(cast.parent_url) : null;

  return (<div className="flex grow">
    <div
      onClick={() => onSelect()}
      className={classNames(
        isSelected ? "bg-gray-700 border-l border-gray-200" : "",
        "grow rounded-r-sm py-1.5 px-3 cursor-pointer"
      )}>
      <div className="flex justify-between gap-x-4">
        <div className="flex flex-row py-0.5 text-xs leading-5 text-gray-300">
          <img
            src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${cast.author.pfp_url}`}
            alt=""
            className="relative mr-1.5 h-5 w-5 flex-none rounded-full bg-gray-50"
            referrerPolicy="no-referrer"
          />
          {cast.parent_hash && <ArrowUturnUpIcon className="w-4 h-4 text-gray-400" />}
          <span className="font-medium text-gray-100">@{cast.author.username} ({cast.author.display_name})</span>
          {showChannel && channel && (
            <div className="flex flex-row">
              <span className="ml-1 -mt-0.5 inline-flex items-center rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
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
      <p className="mt-2 text-sm leading-6 text-gray-300">{cast.text}</p>
      {embedImageUrl && (
        isSelected ? <ImgurImage url={embedImageUrl} /> : <span>🖼️</span>
      )}
      {renderCastReactions(cast)}
    </div>
  </div>)
}
