import { NextRequest, NextResponse } from 'next/server';

const TIMEOUT_MS = 5000; // 5 seconds timeout
const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

// In-memory cache for URL metadata (1 hour TTL)
const metadataCache = new Map<string, { data: UrlMetadata; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export type UrlMetadata = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

const getCachedData = (url: string): UrlMetadata | null => {
  const cached = metadataCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    metadataCache.delete(url); // Remove expired cache
  }
  return null;
};

const setCachedData = (url: string, data: UrlMetadata) => {
  metadataCache.set(url, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically
  if (metadataCache.size > 1000) {
    const now = Date.now();
    const entries = Array.from(metadataCache.entries());
    for (const [k, v] of entries) {
      if (now - v.timestamp > CACHE_TTL) {
        metadataCache.delete(k);
      }
    }
  }
};

async function fetchWithTimeout<T>(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchFromMicrolink(url: string): Promise<UrlMetadata | null> {
  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(apiUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success' || !data.data) {
      return null;
    }

    const { title, description, image, logo } = data.data;

    // Only return if we got at least a title
    if (!title) {
      return null;
    }

    return {
      url,
      title,
      description,
      image: image?.url,
      favicon: logo?.url,
    };
  } catch (error) {
    console.error('Microlink fetch error:', error);
    return null;
  }
}

async function fetchFromNeynar(url: string): Promise<UrlMetadata | null> {
  if (!API_KEY) {
    return null;
  }

  try {
    const apiUrl = `https://api.neynar.com/v2/farcaster/cast/embed/crawl?url=${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(apiUrl, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const html = data?.metadata?.html;

    if (!html) {
      return null;
    }

    const title = html.ogTitle || html.title;

    // Only return if we got at least a title
    if (!title) {
      return null;
    }

    return {
      url,
      title,
      description: html.ogDescription || html.description,
      image: html.ogImage?.[0]?.url,
      favicon: html.favicon,
    };
  } catch (error) {
    console.error('Neynar fetch error:', error);
    return null;
  }
}

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

    // Check cache first
    const cachedData = getCachedData(url);
    if (cachedData) {
      return NextResponse.json({ metadata: cachedData });
    }

    // Try Microlink first (free, no auth)
    let metadata = await fetchFromMicrolink(url);

    // Fall back to Neynar if Microlink fails
    if (!metadata) {
      metadata = await fetchFromNeynar(url);
    }

    // If we got metadata, cache it
    if (metadata) {
      setCachedData(url, metadata);
      return NextResponse.json({ metadata });
    }

    // Return empty metadata if both fail (will use fallback UI)
    const emptyMetadata: UrlMetadata = { url };
    setCachedData(url, emptyMetadata);
    return NextResponse.json({ metadata: emptyMetadata });
  } catch (error) {
    console.error('Error in embeds metadata route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 10;
