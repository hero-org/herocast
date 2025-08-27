import { NextRequest, NextResponse } from 'next/server';
import { FidListContent, isFidListContent } from '@/common/types/list.types';
import { Database } from '@/common/types/database.types';
import createClient from '@/common/helpers/supabase/api';
import { NEYNAR_API_MAX_FIDS_PER_REQUEST } from '@/common/constants/listLimits';

const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');
    const viewerFid = searchParams.get('viewerFid');
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const cursor = searchParams.get('cursor');

    if (!listId) {
      return NextResponse.json({ error: 'Missing listId parameter' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Create authenticated Supabase client
    const supabase = createClient(request);

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get list details
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Handle different list types
    if (isFidListContent(list.content)) {
      const fidListContent = list.content as FidListContent;

      // For now, return a basic response - the full implementation would
      // fetch user data from Neynar API using the FIDs
      return NextResponse.json({
        users: [],
        next: { cursor: null },
      });
    }

    // Handle other list types (search lists, etc.)
    return NextResponse.json({
      casts: [],
      next: { cursor: null },
    });
  } catch (error) {
    console.error('Error in lists route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
