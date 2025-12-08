import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export type UrlMetadata = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

async function fetchUrlMetadataUncached(url: string): Promise<UrlMetadata | null> {
  console.log('[embeds/metadata] Fetching URL:', url);

  // Try Microlink first (free, no auth)
  try {
    const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();

      if (data.status === 'success' && data.data) {
        const { title, description, image, logo } = data.data;

        // Only return if we got at least a title
        if (title) {
          return {
            url,
            title,
            description,
            image: image?.url,
            favicon: logo?.url,
          };
        }
      }
    }
  } catch (error) {
    console.error('Microlink fetch error:', error);
  }

  // Fall back to Neynar
  if (!API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/embed/crawl?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'x-api-key': API_KEY,
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const html = data?.metadata?.html;

      if (html) {
        const title = html.ogTitle || html.title;

        // Only return if we got at least a title
        if (title) {
          // Convert relative favicon to absolute URL
          let faviconUrl = html.favicon;
          if (faviconUrl && !faviconUrl.startsWith('http')) {
            try {
              faviconUrl = new URL(faviconUrl, url).href;
            } catch {
              // Ignore invalid URL
            }
          }

          return {
            url,
            title,
            description: html.ogDescription || html.description,
            image: html.ogImage?.[0]?.url,
            favicon: faviconUrl,
          };
        }
      }
    }
  } catch (error) {
    console.error('Neynar fetch error:', error);
  }

  return null;
}

// Create cached version with unstable_cache (works in Next.js 15 stable)
const getCachedUrlMetadata = (url: string) =>
  unstable_cache(() => fetchUrlMetadataUncached(url), [`url-metadata-${url}`], {
    revalidate: 86400, // 1 day
    tags: ['url-metadata'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const metadata = await getCachedUrlMetadata(url);

    // Return empty metadata if both fail (will use fallback UI)
    return NextResponse.json({ metadata: metadata || { url } });
  } catch (error) {
    console.error('Error in embeds metadata route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 10;
