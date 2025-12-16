import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getUrlsInText, isImageUrl } from '@/common/helpers/text';
import { LinkifiedText } from '@/common/components/LinkifiedText';
import OpenGraphImage from '@/common/components/Embeds/OpenGraphImage';

interface MessageBubbleProps {
  text: string;
  isViewer: boolean;
  isDeleted?: boolean;
  timestamp?: string;
  showTimestamp?: boolean;
}

const MAX_MESSAGE_LENGTH = 500;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  isViewer,
  isDeleted,
  timestamp,
  showTimestamp,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle deleted messages
  if (isDeleted) {
    return (
      <div
        className={cn(
          'rounded-2xl px-4 py-2 italic',
          isViewer ? 'bg-blue-500/20 text-blue-300' : 'bg-muted text-foreground/50'
        )}
      >
        <p className="text-sm break-words">Message deleted</p>
      </div>
    );
  }

  // Handle empty or whitespace-only messages
  const trimmedText = text?.trim() || '';
  if (!trimmedText) {
    return (
      <div
        className={cn(
          'rounded-2xl px-4 py-2 italic',
          isViewer ? 'bg-blue-500/20 text-blue-300' : 'bg-muted text-foreground/50'
        )}
      >
        <p className="text-sm break-words">Empty message</p>
      </div>
    );
  }

  // Detect image URLs using shared helper
  const urls = getUrlsInText(trimmedText);
  const imageUrl = urls.find((u) => isImageUrl(u.url))?.url || null;
  const isImageMessage = Boolean(imageUrl);

  // Get non-image URLs for embeds
  const linkUrls = urls.filter((u) => !isImageUrl(u.url)).map((u) => u.url);

  // Check if message is emoji-only (up to 3 emojis)
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F){1,3}$/u;
  const isEmojiOnly = emojiRegex.test(trimmedText);

  // Determine if we need to show "Show more" button
  const needsExpansion = trimmedText.length > MAX_MESSAGE_LENGTH;
  const displayText = needsExpansion && !isExpanded ? trimmedText.slice(0, MAX_MESSAGE_LENGTH) + '...' : trimmedText;

  let content: React.ReactNode;

  if (isImageMessage && imageUrl) {
    const caption = trimmedText.replace(imageUrl, '').trim();

    content = (
      <>
        <img
          src={imageUrl}
          alt=""
          className="rounded-2xl max-w-full h-auto"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        {caption && (
          <LinkifiedText
            as="p"
            className="mt-1 text-sm whitespace-pre-wrap px-2"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {caption}
          </LinkifiedText>
        )}
      </>
    );
  } else {
    content = (
      <>
        <LinkifiedText
          as="p"
          className={cn('whitespace-pre-wrap', isEmojiOnly ? 'text-3xl' : 'text-sm')}
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {displayText}
        </LinkifiedText>

        {needsExpansion && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'mt-1 text-xs flex items-center gap-1 hover:underline',
              isViewer ? 'text-blue-200' : 'text-foreground/60'
            )}
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'rounded-2xl px-4 py-2 overflow-hidden',
          isViewer ? 'bg-blue-500 text-white' : 'bg-muted text-foreground',
          // keep your smaller padding only for emoji-only *text* messages
          isEmojiOnly && 'px-3 py-1',
          isImageMessage && 'px-0.5 py-0.5',
          isImageMessage && showTimestamp && timestamp && 'pb-2'
        )}
      >
        {content}

        {/* Compact URL embeds */}
        {linkUrls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {linkUrls.slice(0, 2).map((url) => (
              <div
                key={url}
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="cursor-pointer"
              >
                <OpenGraphImage url={url} compact />
              </div>
            ))}
          </div>
        )}

        {showTimestamp && timestamp && (
          <p
            className={cn('text-xs mt-1', isViewer ? 'text-blue-200' : 'text-foreground/60', isImageMessage && 'px-2')}
          >
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
};
