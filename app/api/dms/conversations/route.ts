import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/common/helpers/supabase/route';
import { DirectCastAPI, DirectCastAPIError } from '@/common/helpers/directCastApi';

export const DM_ERROR_CODES = {
  NO_API_KEY: 'NO_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export const config = { maxDuration: 20 };

const TIMEOUT_THRESHOLD = 19000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const cursor = searchParams.get('cursor');
  const limit = searchParams.get('limit') || '25';
  const category = searchParams.get('category') as 'default' | 'request' | 'archived' | undefined;

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized', conversations: [], groups: [] }, { status: 401 });
  }

  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Failed to get API key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account data', code: DM_ERROR_CODES.SERVER_ERROR, conversations: [], groups: [] },
      { status: 500 }
    );
  }

  if (!account?.decrypted_farcaster_api_key) {
    return NextResponse.json(
      { error: 'No DirectCast API key configured', code: DM_ERROR_CODES.NO_API_KEY, conversations: [], groups: [] },
      { status: 200 }
    );
  }

  try {
    const api = new DirectCastAPI({
      apiKey: account.decrypted_farcaster_api_key,
      timeout: TIMEOUT_THRESHOLD,
    });

    const [conversationsRes, groupsRes] = await Promise.all([
      api.getConversationList({
        cursor: cursor || undefined,
        limit: Number(limit),
        category: category || 'default',
      }),
      api.getGroupList({
        cursor: cursor || undefined,
        limit: Number(limit),
        category: category || 'default',
      }),
    ]);

    const conversations = conversationsRes.result?.conversations || [];
    const groups = groupsRes.result?.groups || [];

    return NextResponse.json({
      conversations,
      groups,
      nextCursor: conversationsRes.next?.cursor || groupsRes.next?.cursor,
    });
  } catch (error) {
    if (error instanceof DirectCastAPIError) {
      console.error('DirectCast API error:', error.message, error.statusCode);

      if (error.statusCode === 401 || error.statusCode === 403) {
        return NextResponse.json(
          {
            error: 'DirectCast API key is invalid or expired',
            code: DM_ERROR_CODES.INVALID_API_KEY,
            conversations: [],
            groups: [],
          },
          { status: 200 }
        );
      }

      if (error.statusCode === 429) {
        return NextResponse.json(
          { error: 'Rate limited', code: DM_ERROR_CODES.RATE_LIMITED, conversations: [], groups: [] },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: error.message, conversations: [], groups: [] },
        { status: error.statusCode || 500 }
      );
    }

    console.error('Error fetching DMs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', code: DM_ERROR_CODES.SERVER_ERROR, conversations: [], groups: [] },
      { status: 500 }
    );
  }
}
