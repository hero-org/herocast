/**
 * Pure helpers for the smart-group + stack embed renderer (`MultiEmbedStack`).
 *
 * Lives in its own module so unit tests can import the grouping logic
 * without dragging React, MiniAppHost, Wagmi, etc. through the require graph.
 */

import { isZapperTransactionUrl } from '@/common/helpers/onchain';
import { isImageUrl } from '@/common/helpers/text';
import type { CastEmbed as CastEmbedType } from '@/common/types/farcaster';

export type Frame = {
  version?: string;
  frames_url?: string;
  image?: string;
  title?: string;
};

export type ImageGroup = {
  kind: 'image-gallery';
  urls: string[];
};

export type SlotKind = 'frame-v2' | 'video' | 'cast' | 'tweet' | 'url';

export type SlotGroup = {
  kind: 'slot';
  slotKind: SlotKind;
  embed: CastEmbedType;
  frame?: Frame;
};

export type EmbedGroup = ImageGroup | SlotGroup;

export const isImageEmbedUrl = (url: string): boolean =>
  url.includes('i.imgur.com') ||
  url.includes('res.cloudinary.com') ||
  url.startsWith('https://imagedelivery.net') ||
  isImageUrl(url);

export const isVideoEmbedUrl = (url: string): boolean =>
  url.startsWith('https://stream.warpcast.com') ||
  url.startsWith('https://stream.farcaster.xyz') ||
  url.endsWith('.m3u8');

export const isWarpcastCastUrl = (url: string): boolean =>
  url.startsWith('https://warpcast.com') && !url.includes('/~/');

export const isTweetEmbedUrl = (url: string): boolean =>
  (url.includes('twitter.com') || url.startsWith('https://x.com')) && url.includes('status/');

const buildFrameLookup = (frames: unknown): Map<string, Frame> => {
  const map = new Map<string, Frame>();
  if (!Array.isArray(frames)) return map;
  for (const entry of frames) {
    if (entry && typeof entry === 'object') {
      const f = entry as Frame;
      if (f.frames_url) map.set(f.frames_url, f);
    }
  }
  return map;
};

/**
 * Two-pass: pull every image URL into one bucket so they render as a single
 * gallery, then walk the embeds again and emit slots for the rest in their
 * original order. Image position is intentionally collapsed — Twitter and
 * Bluesky both show multi-image casts as one grid regardless of where the
 * images sit relative to other embeds.
 */
export const groupEmbeds = (embeds: CastEmbedType[], frames: unknown): EmbedGroup[] => {
  const frameLookup = buildFrameLookup(frames);

  const usable = embeds.filter((embed) => {
    if (embed.url && isZapperTransactionUrl(embed.url)) return false;
    return Boolean(embed.url || embed.cast_id);
  });

  // Dedupe by URL: a cast with the same image embedded twice should still
  // render as one gallery slot, not two.
  const galleryUrls = Array.from(
    new Set(
      usable
        .filter((embed): embed is CastEmbedType & { url: string } => Boolean(embed.url) && isImageEmbedUrl(embed.url!))
        .map((embed) => embed.url)
    )
  );

  const groups: EmbedGroup[] = [];
  if (galleryUrls.length > 0) {
    groups.push({ kind: 'image-gallery', urls: galleryUrls });
  }

  for (const embed of usable) {
    if (embed.url && isImageEmbedUrl(embed.url)) continue;

    if (embed.cast_id) {
      groups.push({ kind: 'slot', slotKind: 'cast', embed });
      continue;
    }

    const url = embed.url ?? '';
    const frame = frameLookup.get(url);
    if (frame && frame.version === 'next') {
      groups.push({ kind: 'slot', slotKind: 'frame-v2', embed, frame });
      continue;
    }
    // Frame v1 ("vNext"/"1.0") falls through to the URL slot intentionally —
    // Lane 2A only ships interactive Frame v2; a static v1 image+buttons
    // renderer is deferred. Don't auto-promote v1 entries here.

    if (isVideoEmbedUrl(url)) {
      groups.push({ kind: 'slot', slotKind: 'video', embed });
      continue;
    }

    if (isWarpcastCastUrl(url)) {
      groups.push({ kind: 'slot', slotKind: 'cast', embed });
      continue;
    }

    if (isTweetEmbedUrl(url)) {
      groups.push({ kind: 'slot', slotKind: 'tweet', embed });
      continue;
    }

    groups.push({ kind: 'slot', slotKind: 'url', embed });
  }

  return groups;
};
