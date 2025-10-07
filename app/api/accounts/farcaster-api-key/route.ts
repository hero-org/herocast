import { NextRequest, NextResponse } from 'next/server';
import createClient from '@/common/helpers/supabase/api';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(request);
    const { accountId, apiKey } = await request.json();

    if (!accountId || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('accounts').update({ farcaster_api_key: apiKey }).eq('id', accountId);

    if (error) {
      console.error('Error updating farcaster API key:', error);
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in farcaster-api-key route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
