/**
 * Shared Neynar API helpers for MCP tools
 */

export const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

/**
 * Get the Neynar API key from environment
 */
export function getNeynarApiKey(): string {
  const apiKey = Deno.env.get('NEYNAR_API_KEY');
  if (!apiKey) {
    throw new Error('NEYNAR_API_KEY not configured');
  }
  return apiKey;
}

/**
 * Neynar user response type
 */
export type NeynarUser = {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  profile?: {
    bio?: {
      text?: string;
    };
  };
  follower_count?: number;
  following_count?: number;
  verifications?: string[];
};

/**
 * Format a Neynar user to a simplified structure for API responses
 */
export function formatUser(user: NeynarUser): {
  fid: number;
  username: string;
  display_name: string | null;
  pfp_url: string | null;
  bio?: string | null;
  follower_count?: number;
  following_count?: number;
} {
  return {
    fid: user.fid,
    username: user.username,
    display_name: user.display_name || null,
    pfp_url: user.pfp_url || null,
  };
}

/**
 * Format a Neynar user with full profile details
 */
export function formatUserFull(user: NeynarUser): {
  fid: number;
  username: string;
  display_name: string | null;
  pfp_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
} {
  return {
    fid: user.fid,
    username: user.username,
    display_name: user.display_name || null,
    pfp_url: user.pfp_url || null,
    bio: user.profile?.bio?.text || null,
    follower_count: user.follower_count ?? 0,
    following_count: user.following_count ?? 0,
  };
}

/**
 * Fetch a user by FID from Neynar
 */
export async function fetchUserByFid(fid: number): Promise<NeynarUser | null> {
  const apiKey = getNeynarApiKey();

  const response = await fetch(`${NEYNAR_API_BASE}/user/bulk?fids=${fid}`, {
    headers: { api_key: apiKey },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const text = await response.text();
    throw new Error(`Neynar API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { users: NeynarUser[] };
  return data.users?.[0] || null;
}

/**
 * Fetch a user by username from Neynar
 */
export async function fetchUserByUsername(username: string): Promise<NeynarUser | null> {
  const apiKey = getNeynarApiKey();
  const normalizedUsername = username.trim().replace(/^@/, '');

  const response = await fetch(
    `${NEYNAR_API_BASE}/user/by_username?username=${encodeURIComponent(normalizedUsername)}`,
    {
      headers: { api_key: apiKey },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const text = await response.text();
    throw new Error(`Neynar API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { user: NeynarUser };
  return data.user || null;
}

/**
 * Search for users by query string
 */
export async function searchUsers(query: string, limit: number = 10): Promise<NeynarUser[]> {
  const apiKey = getNeynarApiKey();

  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(Math.max(limit, 1), 25)),
  });

  const response = await fetch(`${NEYNAR_API_BASE}/user/search?${params.toString()}`, {
    headers: { api_key: apiKey },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neynar API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { result: { users: NeynarUser[] } };
  return data.result?.users || [];
}
