import { ChannelNotFoundError, SignerServiceError } from './errors.ts';

/**
 * Channel resolution utilities.
 * Converts channel IDs to parent URLs using the Neynar API.
 */

// Simple in-memory cache for channel URLs within the same request lifecycle
// Map<channelId, parentUrl>
const channelCache = new Map<string, string>();

interface NeynarChannelResponse {
  channel: {
    id: string;
    url: string;
    parent_url: string;
    name: string;
    description: string;
    image_url: string;
    lead: {
      fid: number;
    };
    created_at: number;
    follower_count: number;
  };
}

/**
 * Resolve a Farcaster channel ID to its parent_url.
 * Uses the Neynar API to look up channel details.
 *
 * @param channelId - The channel identifier (e.g., "neynar", "farcaster")
 * @returns The channel's parent_url
 * @throws ChannelNotFoundError if the channel doesn't exist
 */
export async function resolveChannelToUrl(channelId: string): Promise<string> {
  // Check cache first
  const cached = channelCache.get(channelId);
  if (cached) {
    return cached;
  }

  const apiKey = Deno.env.get('NEYNAR_API_KEY');
  if (!apiKey) {
    console.error('[channels] NEYNAR_API_KEY not configured');
    throw new ChannelNotFoundError(channelId);
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/channel?id=${encodeURIComponent(channelId)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        api_key: apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ChannelNotFoundError(channelId);
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[channels] Neynar API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        channelId,
      });

      throw new ChannelNotFoundError(channelId);
    }

    const data: NeynarChannelResponse = await response.json();

    if (!data.channel?.parent_url) {
      console.error('[channels] Channel response missing parent_url:', {
        channelId,
        channel: data.channel,
      });
      throw new ChannelNotFoundError(channelId);
    }

    const parentUrl = data.channel.parent_url;

    // Cache the result for subsequent lookups in the same request
    channelCache.set(channelId, parentUrl);

    return parentUrl;
  } catch (err) {
    // Re-throw SignerServiceError as-is
    if (err instanceof SignerServiceError) {
      throw err;
    }

    // Wrap unexpected errors
    console.error('[channels] Unexpected error resolving channel:', err, { channelId });
    throw new ChannelNotFoundError(channelId);
  }
}

/**
 * Clear the channel cache.
 * Useful for testing or if cache needs to be invalidated.
 */
export function clearChannelCache(): void {
  channelCache.clear();
}
