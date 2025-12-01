import '../src/globals.css';
import React from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import CommandPalette from '@/common/components/CommandPalette';
import { GlobalHotkeys } from '@/common/components/GlobalHotkeys';
import { PerfPanel } from '@/common/components/PerfPanel';

const satoshi = localFont({
  src: [
    {
      path: '../src/assets/fonts/Satoshi-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../src/assets/fonts/Satoshi-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../src/assets/fonts/Satoshi-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-BoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-MediumItalic.woff2',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../src/assets/fonts/Satoshi-Medium.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'herocast',
  description: 'herocast for Farcaster',
  icons: {
    icon: [
      { url: '/images/favicon.ico' },
      { url: '/images/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/images/apple-touch-icon.png',
  },
  openGraph: {
    title: 'herocast',
    description: 'herocast for Farcaster',
    url: 'https://herocast.xyz',
    siteName: 'herocast',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'herocast',
    description: 'herocast for Farcaster',
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://herocast.xyz/images/herocast-logo.png',
    'fc:frame:button:1': 'Open herocast',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://herocast.xyz',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(satoshi.className)}
        style={{
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          WebkitScrollbar: 'none',
        }}
      >
        <Providers>
          <GlobalHotkeys />
          <CommandPalette />
          <PerfPanel />
          {children}
        </Providers>
      </body>
    </html>
  );
}
