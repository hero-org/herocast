/* eslint-disable @next/next/no-title-in-document-head */
import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <title>herocast</title>
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
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
