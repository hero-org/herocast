import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// Root-layout chrome (unit #5) — the same three the Next root layout (app/layout.tsx)
// mounts on EVERY route, incl. /login: cmd+k command palette, global hotkey registry
// (needs AppHotkeysProvider from the #3 provider tree, hence inside <Providers>), and
// the dev-only perf panel. Shared modules, untouched — their next/* imports resolve to
// the src/web adapters via the unit-#2 vite aliases.
import CommandPalette from '@/common/components/CommandPalette';
import { GlobalHotkeys } from '@/common/components/GlobalHotkeys';
import { PerfPanel } from '@/common/components/PerfPanel';
// ?url -> bundled stylesheets linked in the SSR <head> (no FOUC).
//   - @/globals.css        the shared design-token stylesheet (colors, utilities)
//   - @/web/styles/fonts.css  the @font-face + --font-* variable declarations
//     (owned by another agent; referenced here so the <head> wires both in one place)
import appCss from '@/globals.css?url';
import Providers from '@/web/providers/Providers';
import fontsCss from '@/web/styles/fonts.css?url';

// Root document. Mirrors app/layout.tsx: <html lang="en" suppressHydrationWarning>
// (required for next-themes class mutation) + <body> with font-sans + no-scrollbar.
// The Next `metadata`/`viewport` exports become this route's head().
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      },
      { title: 'herocast' },
      { name: 'description', content: 'herocast for Farcaster' },
      // Apple PWA (from metadata.appleWebApp)
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'herocast' },
      // Open Graph (from metadata.openGraph)
      { property: 'og:title', content: 'herocast' },
      { property: 'og:description', content: 'herocast for Farcaster' },
      { property: 'og:url', content: 'https://herocast.xyz' },
      { property: 'og:site_name', content: 'herocast' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:type', content: 'website' },
      // Twitter (from metadata.twitter)
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'herocast' },
      { name: 'twitter:description', content: 'herocast for Farcaster' },
      // Farcaster frame (from metadata.other)
      { name: 'fc:frame', content: 'vNext' },
      { name: 'fc:frame:image', content: 'https://herocast.xyz/images/herocast-logo.png' },
      { name: 'fc:frame:button:1', content: 'Open herocast' },
      { name: 'fc:frame:button:1:action', content: 'link' },
      { name: 'fc:frame:button:1:target', content: 'https://herocast.xyz' },
    ],
    links: [
      { rel: 'stylesheet', href: fontsCss },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/images/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/favicon-32x32.png' },
      { rel: 'apple-touch-icon', href: '/images/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="tanstack-root font-sans no-scrollbar">
        <Providers>
          <GlobalHotkeys />
          <CommandPalette />
          <PerfPanel />
          {children}
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
