import type { ImgHTMLAttributes } from 'react';

// Drop-in replacement for `next/image` (TanStack Start / Vite has no image optimizer).
// Phase 2 swaps `import Image from 'next/image'` -> `import Image from '@/components/ui/image'`.
//
// All 5 herocast next/image sites use only src/alt/width/height/className/aria-hidden
// with FIXED pixel dimensions — no fill/priority/sizes/loader/placeholder — so a thin
// <img> wrapper covers every case. next.config.mjs allowed any remote host (wildcard
// remotePatterns), so arbitrary URLs render directly with no allowlist. Defaults
// (loading="lazy", decoding="async") approximate next/image's lazy behavior.
//
// Inventory of the 5 sites to migrate in Phase 2:
//   1. src/home/index.tsx:145                                       channel.icon_url   20×20
//   2. app/(app)/upgrade/page.tsx:20                                /images/logo.png   24×24
//   3. src/common/components/DirectMessages/DMsOnboarding.tsx:132,168  local png        400×225
//   4. src/common/components/CommandPalette/UserSearchCommand.tsx:84  user.pfp_url      20×20
//   5. src/common/components/CommandPalette/index.tsx:418            command.iconUrl    24×24
// Local assets (/images/logo.png, /images/dms/*.png) must be copied into web/public.
export type ImageProps = ImgHTMLAttributes<HTMLImageElement>;

export default function Image({ loading = 'lazy', decoding = 'async', alt = '', ...rest }: ImageProps) {
  // alt is destructured (defaulting to '') and forwarded; width/height pass through as px attrs.
  return <img alt={alt} loading={loading} decoding={decoding} {...rest} />;
}
