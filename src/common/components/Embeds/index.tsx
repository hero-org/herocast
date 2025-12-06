import React from 'react';
import OnchainEmbed from './OnchainEmbed';
import CastEmbed from './CastEmbed';
import TweetEmbed from './TweetEmbed';
import NounsBuildEmbed from './NounsBuildEmbed';
import ParagraphXyzEmbed from './ParagraphXyzEmbed';
import VideoEmbed from './VideoEmbed';
import OpenGraphImage from './OpenGraphImage';
import { WarpcastImage } from '../PostEmbeddedContent';
import { isImageUrl } from '@/common/helpers/text';
import { MinusCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

type CastEmbedType = {
  url?: string;
  cast_id?: {
    fid: number;
    hash: string;
  };
  castId?: {
    fid: number;
    hash: string;
  };
  onRemove?: () => void;
  hideReactions?: boolean;
  skipIntersection?: boolean;
};

const getEmbedForUrl = (url: string, hideReactions?: boolean, skipIntersection?: boolean) => {
  if (url.includes('i.imgur.com') || url.startsWith('https://imagedelivery.net') || isImageUrl(url)) {
    return <WarpcastImage url={url} />;
  } else if (url.startsWith('"chain:')) {
    return <OnchainEmbed url={url} />;
  } else if (url.startsWith('https://stream.warpcast.com')) {
    return <VideoEmbed url={url} />;
  } else if (url.startsWith('https://warpcast.com') && !url.includes('/~/')) {
    return <CastEmbed url={url} hideReactions={hideReactions} />;
  } else if ((url.includes('twitter.com') || url.startsWith('https://x.com')) && url.includes('status/')) {
    const tweetId = url.split('/').pop();
    return tweetId ? <TweetEmbed tweetId={tweetId} /> : null;
  } else if (url.startsWith('https://nouns.build')) {
    return <NounsBuildEmbed url={url} />;
  } else if (url.includes('paragraph.xyz') || url.includes('pgrph.xyz')) {
    return <ParagraphXyzEmbed url={url} />;
  } else {
    return <OpenGraphImage url={url} skipIntersection={skipIntersection} />;
  }
};

export const renderEmbedForUrl = ({
  url,
  cast_id,
  castId,
  onRemove,
  hideReactions,
  skipIntersection,
}: CastEmbedType) => {
  if (castId || cast_id) {
    return <CastEmbed castId={castId || cast_id} hideReactions={hideReactions} />;
  }
  if (!url) return null;

  const embed = getEmbedForUrl(url, hideReactions, skipIntersection);
  if (!embed) return null;

  return (
    <div className="flex flex-col ">
      {embed}
      {onRemove && (
        <Button onClick={onRemove} size="sm" className="mx-auto h-7 gap-1">
          <MinusCircleIcon className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Remove</span>
        </Button>
      )}
    </div>
  );
};
