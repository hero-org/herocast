import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const CastIdSchema = z.object({
  fid: z.number(),
  hash: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

const EmbedSchema = z.union([z.object({ url: z.string().url() }), z.object({ cast_id: CastIdSchema })]);

const PostCastSchema = z
  .object({
    text: z.string().min(1).max(1024),
    account_id: z.string().uuid().optional(),
    account_username: z.string().optional(),
    channel_id: z.string().optional(),
    parent_url: z.string().url().optional(),
    parent_cast_id: CastIdSchema.optional(),
    embeds: z.array(EmbedSchema).max(2).optional(),
    idempotency_key: z.string().optional(),
    scheduled_for: z.string().datetime().optional(),
  })
  .refine((data) => data.account_id || data.account_username, {
    message: 'Either account_id or account_username is required',
  })
  .refine((data) => !(data.channel_id && data.parent_url), {
    message: 'Use either channel_id or parent_url, not both',
  });

type PostCastInput = z.infer<typeof PostCastSchema>;

export const postCastToolDefinition: ToolDefinition = {
  name: 'post_cast',
  description: 'Post a Farcaster cast using the authenticated user account.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The text content of the cast' },
      account_id: { type: 'string', description: 'UUID of the account to post from' },
      account_username: { type: 'string', description: 'Username of the account (alternative to account_id)' },
      channel_id: { type: 'string', description: "Channel name to post in (e.g., 'neynar')" },
      parent_url: { type: 'string', description: 'Channel URL to post in (alternative to channel_id)' },
      parent_cast_id: {
        type: 'object',
        properties: {
          fid: { type: 'number' },
          hash: { type: 'string' },
        },
      },
      embeds: {
        type: 'array',
        maxItems: 2,
        items: {
          anyOf: [
            { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
            {
              type: 'object',
              properties: {
                cast_id: {
                  type: 'object',
                  properties: {
                    fid: { type: 'number' },
                    hash: { type: 'string' },
                  },
                  required: ['fid', 'hash'],
                },
              },
              required: ['cast_id'],
            },
          ],
        },
      },
      idempotency_key: { type: 'string', description: 'Unique key to prevent duplicate posts on retry' },
      scheduled_for: {
        type: 'string',
        description:
          'ISO 8601 UTC timestamp to schedule the cast (e.g., "2026-01-26T15:00:00Z"). Will be rounded to nearest 5-minute boundary.',
      },
    },
    required: ['text'],
  },
};

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '');
}

function roundToNearest5Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 5) * 5;

  if (roundedMinutes >= 60) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  } else {
    rounded.setMinutes(roundedMinutes);
  }

  rounded.setSeconds(0, 0); // Clear seconds and milliseconds
  return rounded;
}

function validateScheduledTime(isoString: string): { valid: true; date: Date } | { valid: false; error: string } {
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format. Use ISO 8601 UTC (e.g., "2026-01-26T15:00:00Z")' };
  }

  const now = new Date();
  const minScheduleTime = new Date(now.getTime() + 60 * 1000); // 1 minute buffer

  if (date < minScheduleTime) {
    return { valid: false, error: 'Scheduled time must be at least 1 minute in the future' };
  }

  return { valid: true, date };
}

type AccountLookupResult = { accountId: string; status: string | null } | { multiple: true } | null;

async function findAccountMatch(
  supabaseClient: SupabaseClient,
  userId: string,
  applyFilter: (query: any) => any
): Promise<AccountLookupResult> {
  const { data, error } = await applyFilter(
    supabaseClient
      .from('accounts')
      .select('id, status')
      .eq('user_id', userId)
      .eq('platform', 'farcaster')
      .neq('status', 'removed')
  ).limit(2);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (data.length > 1) {
    return { multiple: true };
  }

  const [row] = data;
  if (!row?.id) {
    return null;
  }

  return { accountId: row.id as string, status: (row.status as string | null) ?? null };
}

async function resolveAccountIdByUsername(
  supabaseClient: SupabaseClient,
  userId: string,
  accountUsername: string
): Promise<AccountLookupResult> {
  const normalized = normalizeUsername(accountUsername);
  if (!normalized) return null;

  const normalizedLower = normalized.toLowerCase();

  const exactMatch = await findAccountMatch(supabaseClient, userId, (query) =>
    query.eq('data->>username', normalizedLower)
  );
  if (exactMatch) {
    return exactMatch;
  }

  return findAccountMatch(supabaseClient, userId, (query) => query.ilike('name', normalizedLower));
}

function getSignerServiceUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('API_URL') || Deno.env.get('SUPABASE_API_URL');
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL/API_URL for signer service.');
  }
  return `${supabaseUrl}/functions/v1/farcaster-signer`;
}

function getSupabaseAnonKey(): string {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY');
  if (!anonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY/ANON_KEY for signer service.');
  }
  return anonKey;
}

export async function postCastTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: PostCastInput;
  try {
    parsed = PostCastSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient, userId, token } = auth;
  let accountId = parsed.account_id;
  let accountStatus: string | null | undefined;

  if (!accountId && parsed.account_username) {
    let account: AccountLookupResult;
    try {
      account = await resolveAccountIdByUsername(supabaseClient, userId, parsed.account_username);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Account lookup failed';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'ACCOUNT_LOOKUP_FAILED' }) }],
        isError: true,
      };
    }
    if (!account) {
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
    if ('multiple' in account) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Multiple accounts match this username. Use account_id instead.',
              code: 'ACCOUNT_AMBIGUOUS',
            }),
          },
        ],
        isError: true,
      };
    }
    accountId = account.accountId;
    accountStatus = account.status;
  }

  if (!accountId) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Account not provided', code: 'ACCOUNT_NOT_FOUND' }) }],
      isError: true,
    };
  }

  if (accountStatus && accountStatus !== 'active') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Account is pending activation', code: 'ACCOUNT_PENDING' }),
        },
      ],
      isError: true,
    };
  }

  // Handle scheduled casts
  if (parsed.scheduled_for) {
    const validation = validateScheduledTime(parsed.scheduled_for);
    if (!validation.valid) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: validation.error, code: 'INVALID_SCHEDULE_TIME' }) }],
        isError: true,
      };
    }

    const roundedTime = roundToNearest5Minutes(validation.date);

    // If rounding brought the time into the past, bump to the next 5-minute boundary
    const now = new Date();
    if (roundedTime <= now) {
      roundedTime.setMinutes(roundedTime.getMinutes() + 5);
    }

    const { data, error } = await supabaseClient
      .from('draft')
      .insert({
        account_id: accountId,
        data: {
          text: parsed.text,
          rawText: parsed.text,
          embeds: parsed.embeds,
          parentUrl: parsed.parent_url,
          parentCastId: parsed.parent_cast_id,
          channel_id: parsed.channel_id,
        },
        scheduled_for: roundedTime.toISOString(),
        status: 'scheduled',
      })
      .select('id, scheduled_for')
      .single();

    if (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'SCHEDULE_FAILED' }) }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            scheduled: true,
            draft_id: data.id,
            scheduled_for: data.scheduled_for,
            message: `Cast scheduled for ${data.scheduled_for}`,
          }),
        },
      ],
    };
  }

  // Immediate post
  const payload = {
    account_id: accountId,
    text: parsed.text,
    channel_id: parsed.channel_id,
    parent_url: parsed.parent_url,
    parent_cast_id: parsed.parent_cast_id,
    embeds: parsed.embeds,
    idempotency_key: parsed.idempotency_key,
  };

  const idempotencyKey = parsed.idempotency_key;
  const response = await fetch(`${getSignerServiceUrl()}/cast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: getSupabaseAnonKey(),
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  let responseJson: { success?: boolean; hash?: string; fid?: number; error?: { message?: string; code?: string } } =
    {};
  let responseText = '';
  try {
    responseText = await response.text();
    responseJson = JSON.parse(responseText);
  } catch {
    responseJson = {};
  }

  if (!response.ok || responseJson.success === false) {
    const message = responseJson.error?.message || `Signer service failed (${response.status})`;
    const code = responseJson.error?.code || 'SIGNER_SERVICE_ERROR';
    // Log details for debugging
    console.error('[postCastTool] Signer error:', {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.slice(0, 500),
      parsedError: responseJson.error,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code }) }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ hash: responseJson.hash, fid: responseJson.fid }),
      },
    ],
  };
}
