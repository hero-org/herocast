import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export type MiniAppManifest = {
  name: string;
  iconUrl: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  homeUrl: string;
  webhookUrl?: string;
};

/**
 * Validates that a URL is secure (HTTPS, or HTTP for localhost in dev)
 */
function isValidSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Require HTTPS in production, allow HTTP for localhost
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev =
      parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    return isHttps || isLocalDev;
  } catch {
    return false;
  }
}

/**
 * Validates a color string is safe (hex, rgb, or named color)
 * Prevents CSS injection via url() or expression()
 */
function isValidColor(color: string | undefined): boolean {
  if (!color) return true; // undefined is ok
  // Allow hex colors
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return true;
  // Allow rgb/rgba with only numbers
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) return true;
  // Reject everything else
  return false;
}

/**
 * Truncates a string to prevent DoS via extremely long values
 */
function truncateString(str: string | undefined, maxLength: number): string | undefined {
  if (!str) return undefined;
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

async function fetchMiniAppManifestUncached(url: string): Promise<MiniAppManifest | null> {
  const startTime = Date.now();
  console.log('[miniapp/manifest] Fetching manifest for:', url);

  try {
    // Construct the well-known manifest URL
    const manifestUrl = new URL('/.well-known/farcaster.json', url).href;
    console.log('[miniapp/manifest] Fetching from:', manifestUrl);

    const response = await fetch(manifestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HerocastBot/1.0; +https://herocast.xyz)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log(
        `[miniapp/manifest] Fetch failed with status ${response.status} for ${manifestUrl} in ${Date.now() - startTime}ms`
      );
      return null;
    }

    const data = await response.json();
    console.log(`[miniapp/manifest] Successfully fetched manifest in ${Date.now() - startTime}ms`);

    // Validate required fields exist and are strings
    if (typeof data.name !== 'string' || typeof data.iconUrl !== 'string' || typeof data.homeUrl !== 'string') {
      console.log('[miniapp/manifest] Invalid manifest: missing or invalid required fields');
      return null;
    }

    // Validate URLs are secure HTTPS URLs
    if (!isValidSecureUrl(data.homeUrl)) {
      console.log('[miniapp/manifest] Invalid manifest: homeUrl must be HTTPS');
      return null;
    }

    if (!isValidSecureUrl(data.iconUrl)) {
      console.log('[miniapp/manifest] Invalid manifest: iconUrl must be HTTPS');
      return null;
    }

    // Validate optional URLs if present
    if (data.splashImageUrl && !isValidSecureUrl(data.splashImageUrl)) {
      console.log('[miniapp/manifest] Warning: invalid splashImageUrl, ignoring');
      data.splashImageUrl = undefined;
    }

    // Validate color is safe
    if (data.splashBackgroundColor && !isValidColor(data.splashBackgroundColor)) {
      console.log('[miniapp/manifest] Warning: invalid splashBackgroundColor, ignoring');
      data.splashBackgroundColor = undefined;
    }

    // Return the manifest with sanitized values
    // Truncate strings to prevent DoS via extremely long values
    return {
      name: truncateString(data.name, 100) as string,
      iconUrl: data.iconUrl,
      splashImageUrl: data.splashImageUrl,
      splashBackgroundColor: data.splashBackgroundColor,
      homeUrl: data.homeUrl,
      webhookUrl: data.webhookUrl && isValidSecureUrl(data.webhookUrl) ? data.webhookUrl : undefined,
    };
  } catch (error) {
    console.error(`[miniapp/manifest] Error fetching manifest for ${url} after ${Date.now() - startTime}ms:`, error);
    return null;
  }
}

// Create cached version with unstable_cache - cache for 7 days
const getCachedMiniAppManifest = (url: string) =>
  unstable_cache(() => fetchMiniAppManifestUncached(url), [`miniapp-manifest-${url}`], {
    revalidate: 604800, // 7 days in seconds
    tags: ['miniapp-manifest'],
  })();

/**
 * Security headers for API responses
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Prevent framing of this API response
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return addSecurityHeaders(NextResponse.json({ error: 'Missing url parameter' }, { status: 400 }));
    }

    // Validate URL format and ensure it's a secure HTTPS URL
    if (!isValidSecureUrl(url)) {
      console.log(`[miniapp/manifest] Invalid or insecure URL: ${url}`);
      return addSecurityHeaders(NextResponse.json({ error: 'Invalid URL format. HTTPS required.' }, { status: 400 }));
    }

    const manifest = await getCachedMiniAppManifest(url);

    // Return the manifest (null if fetch failed)
    return addSecurityHeaders(NextResponse.json({ manifest }));
  } catch (error) {
    console.error('Error in miniapp manifest route:', error);
    return addSecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export const maxDuration = 10;
