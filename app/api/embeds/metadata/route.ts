import { readFileSync } from 'fs';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// Trek WASM initialization (singleton via globalThis)
// Module-level singletons don't work reliably in Next.js due to dual module loaders
// (next-server.js and webpack-runtime.js). Using globalThis ensures true singleton.
// See: https://www.hawu.me/dev/6268
//
// IMPORTANT: We use dynamic import + initSync to fix module duplication issue.
// Next.js webpack creates multiple module instances, so `initTrek()` sets `wasm`
// in one instance but `TrekWasm` reads from another where `wasm` is undefined.
// By dynamically importing and using initSync, we ensure the same module instance.
type TrekModule = typeof import('@officialunofficial/trek');
const globalForTrek = globalThis as typeof globalThis & {
  __trekInitPromise?: Promise<TrekModule>;
};

async function ensureTrekInitialized(): Promise<TrekModule> {
  // Capture reference to avoid TOCTOU race condition:
  // If we return globalForTrek.__trekInitPromise directly, another request's
  // catch handler might clear it to undefined between our check and return.
  let promise = globalForTrek.__trekInitPromise;

  if (!promise) {
    // Store the promise so concurrent requests await the same initialization
    promise = (async () => {
      // Load WASM as buffer from file system
      const wasmPath = join(process.cwd(), 'node_modules/@officialunofficial/trek/trek_rs_bg.wasm');
      const wasmBuffer = readFileSync(wasmPath);

      // Dynamic import ensures we get a single module instance
      // Using initSync ensures wasm variable is set in the same module instance
      const trekModule = await import('@officialunofficial/trek');
      trekModule.initSync({ module: wasmBuffer });

      return trekModule;
    })().catch((error) => {
      // Clear the promise on failure so it can be retried
      globalForTrek.__trekInitPromise = undefined;
      throw error;
    });
    globalForTrek.__trekInitPromise = promise;
  }

  // Return captured reference, not the global (which might be cleared by now)
  return promise;
}

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

// Try to fetch and parse with Trek (direct fetch + local WASM parsing)
async function fetchWithTrek(url: string): Promise<UrlMetadata | null> {
  const startTime = Date.now();

  try {
    const trekModule = await ensureTrekInitialized();
    console.log(`[embeds/metadata] Trek WASM initialized in ${Date.now() - startTime}ms`);

    const fetchStart = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HerocastBot/1.0; +https://herocast.xyz)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log(
        `[embeds/metadata] Trek fetch failed with status ${response.status} for ${url} in ${Date.now() - fetchStart}ms`
      );
      return null;
    }

    const html = await response.text();
    console.log(`[embeds/metadata] Trek fetched ${html.length} bytes in ${Date.now() - fetchStart}ms`);

    // Check for Cloudflare challenge pages
    if (
      html.includes('cf-browser-verification') ||
      html.includes('challenge-platform') ||
      html.includes('Just a moment...')
    ) {
      console.log(`[embeds/metadata] Trek detected Cloudflare challenge for ${url}, skipping`);
      return null;
    }

    const parseStart = Date.now();
    // Trek uses serde flatten, so we must provide ALL fields from nested structs
    // See: https://github.com/officialunofficial/trek/blob/main/src/types.rs
    // Use TrekWasm from the dynamically imported module to avoid module duplication
    const trek = new trekModule.TrekWasm({
      url,
      debug: false,
      // OutputOptions (flattened)
      markdown: false,
      separateMarkdown: false,
      // RemovalOptions (flattened)
      removeExactSelectors: true,
      removePartialSelectors: true,
    });
    const result = trek.parse(html);
    console.log(`[embeds/metadata] Trek parsed in ${Date.now() - parseStart}ms`);

    // Trek returns metadata including OG tags
    const metadata = result.metadata || {};
    const title = metadata.title || metadata.og_title || result.title;

    if (title) {
      // Try to extract favicon from parsed HTML or construct default
      let favicon: string | undefined;
      try {
        favicon = new URL('/favicon.ico', url).href;
      } catch {
        // Ignore invalid URL
      }

      console.log(`[embeds/metadata] Trek success for ${url} (total: ${Date.now() - startTime}ms)`);
      return {
        url,
        title,
        description: metadata.description || metadata.og_description,
        image: metadata.og_image || metadata.image,
        favicon,
      };
    }

    console.log(`[embeds/metadata] Trek no title found for ${url} in ${Date.now() - startTime}ms`);
    return null;
  } catch (error) {
    console.error(`[embeds/metadata] Trek error for ${url} after ${Date.now() - startTime}ms:`, error);
    return null;
  }
}

async function fetchUrlMetadataUncached(url: string): Promise<UrlMetadata | null> {
  const startTime = Date.now();
  console.log('[embeds/metadata] Fetching URL:', url);

  // Step 1: Try Trek first (direct fetch + local WASM parsing - no external API)
  const trekResult = await fetchWithTrek(url);
  if (trekResult) {
    return trekResult;
  }
  console.log(`[embeds/metadata] Trek failed for ${url} after ${Date.now() - startTime}ms, trying Microlink...`);

  // Step 2: Try Microlink (free external API)
  const microlinkStart = Date.now();
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
          console.log(
            `[embeds/metadata] Microlink success for ${url} in ${Date.now() - microlinkStart}ms (total: ${Date.now() - startTime}ms)`
          );
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
    console.log(
      `[embeds/metadata] Microlink no result for ${url} in ${Date.now() - microlinkStart}ms, trying Neynar...`
    );
  } catch (error) {
    console.error(`[embeds/metadata] Microlink error for ${url} after ${Date.now() - microlinkStart}ms:`, error);
  }

  // Step 3: Fall back to Neynar (uses API quota)
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

          console.log(
            `[embeds/metadata] Neynar success for ${url} in ${Date.now() - neynarStart}ms (total: ${Date.now() - startTime}ms)`
          );
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
