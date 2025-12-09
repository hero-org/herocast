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

// Only allow http/https URLs - skip custom URI schemes like zoraCoin://, chain:, etc.
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchUrlMetadataUncached(url: string): Promise<UrlMetadata | null> {
  const startTime = Date.now();
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
          console.log(`[embeds/metadata] Microlink success for ${url} in ${Date.now() - startTime}ms`);
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
    console.log(`[embeds/metadata] Microlink no result for ${url}, trying Neynar...`);
  } catch (error) {
    console.error(`[embeds/metadata] Microlink error for ${url} after ${Date.now() - startTime}ms:`, error);
  }

  // Fall back to Neynar
  if (!API_KEY) {
    console.log(`[embeds/metadata] No Neynar API key, returning null for ${url}`);
    return null;
  }

  try {
    const neynarStart = Date.now();
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

          console.log(`[embeds/metadata] Neynar success for ${url} in ${Date.now() - neynarStart}ms (total: ${Date.now() - startTime}ms)`);
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
    console.log(`[embeds/metadata] Neynar no result for ${url} after ${Date.now() - neynarStart}ms`);
  } catch (error) {
    console.error(`[embeds/metadata] Neynar error for ${url} after ${Date.now() - startTime}ms:`, error);
  }

  console.log(`[embeds/metadata] No metadata found for ${url} (total: ${Date.now() - startTime}ms)`);
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

    // Validate URL format and ensure it's an HTTP(S) URL
    if (!isValidHttpUrl(url)) {
      console.log(`[embeds/metadata] Skipping non-HTTP URL: ${url}`);
      // Return empty metadata for non-HTTP URLs (custom URI schemes like zoraCoin://, chain:, etc.)
      return NextResponse.json({ metadata: { url } });
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
