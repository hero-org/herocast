import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

const GetCastsSchema = z
  .object({
    fid: z.number().int().positive().optional(),
    account_id: z.string().uuid().optional(),
    account_username: z.string().optional(),
    cast_hash: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .optional(),
    limit: z.number().int().min(1).max(25).default(10).optional(),
    cursor: z.string().optional(),
  })
  .refine((data) => data.cast_hash || data.fid || data.account_id || data.account_username, {
    message: 'Provide cast_hash for lookup, or fid/account_id/account_username for user casts',
  });

type GetCastsInput = z.infer<typeof GetCastsSchema>;

export const getCastsToolDefinition: ToolDefinition = {
  name: 'get_casts',
  description: 'Fetch recent casts for a user by FID or connected account, or lookup a specific cast by hash.',
  inputSchema: {
    type: 'object',
    properties: {
      fid: { type: 'number', description: 'Farcaster ID to fetch casts for' },
      account_id: { type: 'string', description: 'UUID of connected account (resolves to FID)' },
      account_username: {
        type: 'string',
        description: 'Username of connected account (resolves to FID)',
      },
      cast_hash: {
        type: 'string',
        description: 'Cast hash (0x...) to lookup a specific cast. When provided, ignores user params.',
      },
      limit: { type: 'number', description: 'Number of casts to return (1-25, default 10)' },
      cursor: { type: 'string', description: 'Pagination cursor for next page' },
    },
  },
};

type AccountRow = {
  id: string;
  platform_account_id: string | null;
  data: Record<string, unknown> | null;
};

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '');
}

async function resolveFidFromAccountId(
  supabaseClient: SupabaseClient,
  userId: string,
  accountId: string
): Promise<number | null> {
  const { data, error } = await supabaseClient
    .from('accounts')
    .select('platform_account_id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .eq('platform', 'farcaster')
    .neq('status', 'removed')
    .single();

  if (error || !data?.platform_account_id) {
    return null;
  }

  return Number(data.platform_account_id);
}

async function resolveFidFromUsername(
  supabaseClient: SupabaseClient,
  userId: string,
  username: string
): Promise<number | null> {
  const normalized = normalizeUsername(username).toLowerCase();
  if (!normalized) return null;

  // Try exact username match first
  const { data: exactMatch } = await supabaseClient
    .from('accounts')
    .select('platform_account_id')
    .eq('user_id', userId)
    .eq('platform', 'farcaster')
    .neq('status', 'removed')
    .eq('data->>username', normalized)
    .limit(1)
    .single();

  if (exactMatch?.platform_account_id) {
    return Number(exactMatch.platform_account_id);
  }

  // Fall back to name match
  const { data: nameMatch } = await supabaseClient
    .from('accounts')
    .select('platform_account_id')
    .eq('user_id', userId)
    .eq('platform', 'farcaster')
    .neq('status', 'removed')
    .ilike('name', normalized)
    .limit(1)
    .single();

  if (nameMatch?.platform_account_id) {
    return Number(nameMatch.platform_account_id);
  }

  return null;
}

function getNeynarApiKey(): string {
  const apiKey = Deno.env.get('NEYNAR_API_KEY');
  if (!apiKey) {
    throw new Error('NEYNAR_API_KEY not configured');
  }
  return apiKey;
}

type NeynarCast = {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name?: string;
  };
  text: string;
  timestamp: string;
  replies: { count: number };
  reactions: { likes_count: number; recasts_count: number };
  embeds?: Array<{ url?: string; cast_id?: { fid: number; hash: string } }>;
};

type NeynarFeedResponse = {
  casts: NeynarCast[];
  next?: { cursor?: string };
};

type NeynarCastResponse = {
  cast: NeynarCast;
};

function formatCast(cast: NeynarCast) {
  return {
    hash: cast.hash,
    author: {
      fid: cast.author.fid,
      username: cast.author.username,
      display_name: cast.author.display_name || null,
    },
    text: cast.text,
    timestamp: cast.timestamp,
    replies_count: cast.replies?.count ?? 0,
    likes_count: cast.reactions?.likes_count ?? 0,
    recasts_count: cast.reactions?.recasts_count ?? 0,
    embeds: cast.embeds ?? [],
  };
}

async function fetchUserCasts(
  fid: number,
  limit: number,
  cursor?: string
): Promise<{ casts: ReturnType<typeof formatCast>[]; next_cursor?: string }> {
  const apiKey = getNeynarApiKey();

  const params = new URLSearchParams({
    feed_type: 'filter',
    filter_type: 'fids',
    fids: String(fid),
    limit: String(limit),
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await fetch(`${NEYNAR_API_BASE}/feed?${params.toString()}`, {
    headers: { api_key: apiKey },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neynar API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as NeynarFeedResponse;

  return {
    casts: data.casts.map(formatCast),
    next_cursor: data.next?.cursor,
  };
}

async function lookupCast(hash: string): Promise<ReturnType<typeof formatCast>> {
  const apiKey = getNeynarApiKey();

  const params = new URLSearchParams({
    identifier: hash,
    type: 'hash',
  });

  const response = await fetch(`${NEYNAR_API_BASE}/cast?${params.toString()}`, {
    headers: { api_key: apiKey },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neynar API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as NeynarCastResponse;
  return formatCast(data.cast);
}

export async function getCastsTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: GetCastsInput;
  try {
    parsed = GetCastsSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient, userId } = auth;

  // Mode 1: Cast lookup by hash
  if (parsed.cast_hash) {
    try {
      const cast = await lookupCast(parsed.cast_hash);
      return {
        content: [{ type: 'text', text: JSON.stringify({ casts: [cast] }) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cast lookup failed';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'CAST_LOOKUP_FAILED' }) }],
        isError: true,
      };
    }
  }

  // Mode 2: User casts - need to resolve FID
  let fid = parsed.fid;

  if (!fid && parsed.account_id) {
    fid = await resolveFidFromAccountId(supabaseClient, userId, parsed.account_id);
    if (!fid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Account not found or not accessible', code: 'ACCOUNT_NOT_FOUND' }),
          },
        ],
        isError: true,
      };
    }
  }

  if (!fid && parsed.account_username) {
    fid = await resolveFidFromUsername(supabaseClient, userId, parsed.account_username);
    if (!fid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Account not found or not accessible', code: 'ACCOUNT_NOT_FOUND' }),
          },
        ],
        isError: true,
      };
    }
  }

  if (!fid) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Provide cast_hash for lookup, or fid/account_id/account_username for user casts',
            code: 'INVALID_PARAMS',
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const limit = parsed.limit ?? 10;
    const result = await fetchUserCasts(fid, limit, parsed.cursor);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch casts';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'FETCH_CASTS_FAILED' }) }],
      isError: true,
    };
  }
}
