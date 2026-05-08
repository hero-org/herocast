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

/**
 * Best-effort: extract a Farcaster cast hash from a permalink URL. Handles
 *   - https://farcaster.xyz/~/ca/0x<full-hash>
 *   - https://warpcast.com/<user>/0x<short-or-full-hash>
 *   - https://farcaster.xyz/<user>/0x<short-or-full-hash>
 *
 * Returns lowercase hex or null. Used to dedupe URL embeds against `cast_id`
 * embeds that already carry the same hash — a recasting client sometimes
 * stamps both into the embed list, and rendering them twice is noise.
 */
export const extractCastHashFromUrl = (url: string): string | null => {
  const farcasterCa = url.match(/farcaster\.xyz\/~\/ca\/(0x[0-9a-fA-F]+)/);
  if (farcasterCa) return farcasterCa[1].toLowerCase();
  const userPath = url.match(/(?:warpcast\.com|farcaster\.xyz)\/[^/]+\/(0x[0-9a-fA-F]+)/);
  if (userPath) return userPath[1].toLowerCase();
  return null;
};

/**
 * Two cast hashes match if either is a prefix of the other (Warpcast user
 * URLs typically use the first 10 hex chars of the full 40-char hash, so
 * exact-match would miss legitimate duplicates).
 */
const castHashesMatch = (a: string, b: string): boolean => a.startsWith(b) || b.startsWith(a);

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
 *
 * Also deduplicates noise from clients that stamp the same content into the
 * embed list multiple times: identical `cast_id.hash` collapses to one cast
 * slot, and a URL embed that resolves to the same cast hash as a `cast_id`
 * embed is dropped (otherwise the same cast renders three times — once as
 * cast_id, once as a farcaster.xyz/~/ca permalink, etc).
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

  // Collect every cast hash referenced by `cast_id` embeds so we can strip
  // URL embeds that point at the same cast (cross-format duplicate).
  const castIdHashes: string[] = usable
    .map((embed) => embed.cast_id?.hash?.toLowerCase())
    .filter((h): h is string => Boolean(h));
  // Track which cast hashes we've already emitted as slots so duplicate
  // `cast_id` entries collapse to a single slot.
  const emittedCastHashes = new Set<string>();
  // And the URLs we've already emitted, so a cast with the same non-image
  // URL stamped twice doesn't render twice either.
  const emittedUrls = new Set<string>();

  const groups: EmbedGroup[] = [];
  if (galleryUrls.length > 0) {
    groups.push({ kind: 'image-gallery', urls: galleryUrls });
  }

  for (const embed of usable) {
    if (embed.url && isImageEmbedUrl(embed.url)) continue;

    if (embed.cast_id) {
      const hash = embed.cast_id.hash?.toLowerCase();
      if (hash && emittedCastHashes.has(hash)) continue;
      if (hash) emittedCastHashes.add(hash);
      groups.push({ kind: 'slot', slotKind: 'cast', embed });
      continue;
    }

    const url = embed.url ?? '';
    if (emittedUrls.has(url)) continue;

    // Skip URL embeds that point at a cast we've already emitted via
    // `cast_id`. Catches the common case where a client posts both a
    // structured cast embed and a permalink URL for the same content.
    const urlCastHash = extractCastHashFromUrl(url);
    if (urlCastHash && castIdHashes.some((h) => castHashesMatch(h, urlCastHash))) {
      continue;
    }

    const frame = frameLookup.get(url);
    if (frame && frame.version === 'next') {
      emittedUrls.add(url);
      groups.push({ kind: 'slot', slotKind: 'frame-v2', embed, frame });
      continue;
    }
    // Frame v1 ("vNext"/"1.0") falls through to the URL slot intentionally —
    // Lane 2A only ships interactive Frame v2; a static v1 image+buttons
    // renderer is deferred. Don't auto-promote v1 entries here.

    if (isVideoEmbedUrl(url)) {
      emittedUrls.add(url);
      groups.push({ kind: 'slot', slotKind: 'video', embed });
      continue;
    }

    if (isWarpcastCastUrl(url)) {
      emittedUrls.add(url);
      groups.push({ kind: 'slot', slotKind: 'cast', embed });
      continue;
    }

    if (isTweetEmbedUrl(url)) {
      emittedUrls.add(url);
      groups.push({ kind: 'slot', slotKind: 'tweet', embed });
      continue;
    }

    emittedUrls.add(url);
    groups.push({ kind: 'slot', slotKind: 'url', embed });
  }

  return groups;
};
