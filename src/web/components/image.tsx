// next/image inventory: 5 importer sites on main (verified via grep). The TanStack
// build aliases `next/image` → this shim (Area B); the live Next build keeps real
// next/image. TanStack Start / Vite has no image optimizer, so this is a thin <img>.
//
// Props in use across the 5 sites: src/alt/width/height/className (+ aria-hidden), all
// FIXED pixel dims. next.config.mjs allowed any remote host (wildcard remotePatterns),
// so arbitrary URLs render directly with no allowlist. We additionally support the rest
// of next/image's common prop surface so a ported surface can pass fill/priority/sizes/
// loader/etc. without leaking an invalid DOM attribute (React warns otherwise):
//   - width/height → forwarded (valid <img> attrs), but dropped when `fill` is set
//     (next/image forbids width/height with fill).
//   - fill         → absolutely fills the positioned parent via style.
//   - priority     → eager loading (next/image preloads priority images).
//   - sizes        → forwarded as-is (valid <img> attr; flows through ...rest).
//   - loader/quality/placeholder/blurDataURL/unoptimized/onLoadingComplete/overrideSrc
//                  → optimizer-only; accepted then dropped (no Vite image pipeline).
// Defaults (loading="lazy", decoding="async") approximate next/image's lazy behavior.
import type { CSSProperties, ImgHTMLAttributes } from 'react';

type NextImageOnlyProps = {
  fill?: boolean;
  priority?: boolean;
  loader?: unknown;
  quality?: number | string;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  onLoadingComplete?: unknown;
  overrideSrc?: string;
};

export type ImageProps = ImgHTMLAttributes<HTMLImageElement> & NextImageOnlyProps;

export default function Image({
  alt = '',
  decoding = 'async',
  loading,
  fill,
  priority,
  width,
  height,
  style,
  // optimizer-only props — accepted then dropped:
  loader: _loader,
  quality: _quality,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  unoptimized: _unoptimized,
  onLoadingComplete: _onLoadingComplete,
  overrideSrc: _overrideSrc,
  ...rest
}: ImageProps) {
  // priority → eager (next/image preloads priority images); otherwise next/image's lazy default.
  const resolvedLoading = loading ?? (priority ? 'eager' : 'lazy');
  // fill → absolutely fill the (positioned) parent. Caller style wins on conflict.
  const resolvedStyle: CSSProperties | undefined = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }
    : style;
  // next/image forbids width/height alongside fill, so drop them in that case.
  const dimensions = fill ? {} : { width, height };
  // src/alt/className/sizes/aria-* and other valid <img> attrs flow through `rest`.
  return (
    <img alt={alt} decoding={decoding} loading={resolvedLoading} style={resolvedStyle} {...dimensions} {...rest} />
  );
}
