// Our own embed types - replaces @mod-protocol/farcaster imports

export type UrlMetadata = {
  title?: string;
  description?: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
  mimeType?: string;
};

// URL-based embed (images, links, videos)
export type FarcasterUrlEmbed = {
  url: string;
  status?: 'loading' | 'loaded';
  metadata?: UrlMetadata;
};

// Cast quote embed
export type FarcasterCastEmbed = {
  castId: {
    fid: number;
    hash: string;
  };
};

// Union type matching mod-protocol's FarcasterEmbed
export type FarcasterEmbed = FarcasterUrlEmbed | FarcasterCastEmbed;

// Type guards
export const isUrlEmbed = (embed: FarcasterEmbed): embed is FarcasterUrlEmbed => {
  return 'url' in embed;
};

export const isCastEmbed = (embed: FarcasterEmbed): embed is FarcasterCastEmbed => {
  return 'castId' in embed;
};

export const isImageEmbed = (embed: FarcasterEmbed): boolean => {
  if (!isUrlEmbed(embed)) return false;
  const url = embed.url.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) || embed.metadata?.image?.url != null;
};

// For compatibility with existing code that uses Embed type from mod-protocol
export type Embed = FarcasterEmbed;

// Mention type for autocomplete - replaces @mod-protocol/farcaster FarcasterMention
export type FarcasterMention = {
  fid: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  pfp_url?: string;
};
