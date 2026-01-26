import { type NextRequest, NextResponse } from 'next/server';
import { DIRECT_CAST_API } from '@/common/constants/directCast';
import { DirectCastAPI, DirectCastAPIError } from '@/common/helpers/directCastApi';
import { createClient } from '@/common/helpers/supabase/route';

const DM_ERROR_CODES = {
  NO_API_KEY: 'NO_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const conversationId = searchParams.get('conversationId');
  const groupId = searchParams.get('groupId');
  const cursor = searchParams.get('cursor');
  const limit = searchParams.get('limit') || '25';

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  if (!conversationId && !groupId) {
    return NextResponse.json({ error: 'Either conversationId or groupId is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized', messages: [] }, { status: 401 });
  }

  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Failed to get account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account data', code: DM_ERROR_CODES.SERVER_ERROR, messages: [] },
      { status: 500 }
    );
  }

  if (!account?.decrypted_farcaster_api_key) {
    return NextResponse.json(
      { error: 'No DirectCast API key configured', code: DM_ERROR_CODES.NO_API_KEY, messages: [] },
      { status: 200 }
    );
  }

  try {
    const api = new DirectCastAPI({ apiKey: account.decrypted_farcaster_api_key });

    const response = await api.getMessageList({
      conversationId: conversationId || undefined,
      groupId: groupId || undefined,
      cursor: cursor || undefined,
      limit: Number(limit),
    });

    return NextResponse.json({
      messages: response.result?.messages || [],
      nextCursor: response.next?.cursor,
    });
  } catch (error) {
    if (error instanceof DirectCastAPIError) {
      console.error('DirectCast API error:', error.message, error.statusCode);

      if (error.statusCode === 401 || error.statusCode === 403) {
        return NextResponse.json(
          { error: 'DirectCast API key is invalid or expired', code: DM_ERROR_CODES.INVALID_API_KEY, messages: [] },
          { status: 200 }
        );
      }

      if (error.statusCode === 429) {
        return NextResponse.json(
          { error: 'Rate limited', code: DM_ERROR_CODES.RATE_LIMITED, messages: [] },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: error.message, messages: [] }, { status: error.statusCode || 500 });
    }

    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', code: DM_ERROR_CODES.SERVER_ERROR, messages: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  const body = await request.json();
  const { conversationId, groupId, recipientFid, message, inReplyToMessageId } = body;

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  if (!conversationId && !groupId && !recipientFid) {
    return NextResponse.json({ error: 'Either conversationId, groupId, or recipientFid is required' }, { status: 400 });
  }

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (message.length > DIRECT_CAST_API.MESSAGE.MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds maximum length of ${DIRECT_CAST_API.MESSAGE.MAX_LENGTH} characters` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: account, error } = await supabase
    .from('decrypted_dm_accounts')
    .select('decrypted_farcaster_api_key')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Failed to get account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account data', code: DM_ERROR_CODES.SERVER_ERROR },
      { status: 500 }
    );
  }

  if (!account?.decrypted_farcaster_api_key) {
    return NextResponse.json(
      { error: 'No DirectCast API key configured', code: DM_ERROR_CODES.NO_API_KEY },
      { status: 200 }
    );
  }

  try {
    const api = new DirectCastAPI({ apiKey: account.decrypted_farcaster_api_key });

    const idempotencyKey = `${accountId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const response = await api.sendMessage({
      conversationId,
      groupId,
      recipientFid: recipientFid ? Number(recipientFid) : undefined,
      message,
      inReplyToMessageId,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      message: response.result?.message || response,
    });
  } catch (error) {
    if (error instanceof DirectCastAPIError) {
      console.error('DirectCast API error:', error.message, error.statusCode);

      if (error.statusCode === 401 || error.statusCode === 403) {
        return NextResponse.json(
          { error: 'DirectCast API key is invalid or expired', code: DM_ERROR_CODES.INVALID_API_KEY },
          { status: 200 }
        );
      }

      if (error.statusCode === 429) {
        return NextResponse.json({ error: 'Rate limited', code: DM_ERROR_CODES.RATE_LIMITED }, { status: 429 });
      }

      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }

    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message', code: DM_ERROR_CODES.SERVER_ERROR }, { status: 500 });
  }
}
