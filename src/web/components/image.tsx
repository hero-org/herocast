// next/image inventory: 5 importer sites on main — port those in Phase 2; copy local image assets to public/ then.
//
// Drop-in replacement for `next/image`. TanStack Start / Vite has no image optimizer,
// so this is a thin <img> wrapper. All 5 next/image sites on main use only
// src/alt/width/height/className (+ aria-hidden) with FIXED pixel dimensions — no
// fill/priority/sizes/loader/placeholder — so a plain <img> covers every case.
// next.config.mjs allowed any remote host (wildcard remotePatterns), so arbitrary
// URLs render directly with no allowlist. Defaults (loading="lazy",
// decoding="async") approximate next/image's lazy behavior.
import type { ImgHTMLAttributes } from 'react';

export type ImageProps = ImgHTMLAttributes<HTMLImageElement>;

export default function Image({ alt = '', loading = 'lazy', decoding = 'async', ...rest }: ImageProps) {
  // alt defaults to '' and forwards; src/width/height/className pass through unchanged.
  return <img alt={alt} loading={loading} decoding={decoding} {...rest} />;
}
