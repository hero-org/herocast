import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: 'next',
  imageUrl: `${appUrl}/images/herocast_og.png`,
  button: {
    title: 'Launch herocast',
    action: {
      type: 'launch_frame',
      name: 'herocast',
      url: appUrl,
      splashImageUrl: `${appUrl}/images/splash.png`,
      splashBackgroundColor: '#f7f7f7',
    },
  },
};

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="herocast" />
        <meta property="og:site_name" content="herocast" />
        <meta property="og:title" content="herocast" />
        <meta property="og:type" content="website" />
        <meta
          property="og:description"
          content="herocast - #1 open-source Farcaster client for professionals and teams"
        />
        <meta property="og:url" content="https://app.herocast.xyz" />
        <meta property="og:image" content="/images/herocast_og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta name="fc:frame" content={JSON.stringify(frame)} />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
        <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
