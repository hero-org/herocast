import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/common/helpers/supabase/route';
import { DIRECT_CAST_API } from '@/common/constants/directCast';

// Validate API key by making a lightweight call to the Farcaster API
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${DIRECT_CAST_API.BASE_URL}${DIRECT_CAST_API.ENDPOINTS.LIST_CONVERSATIONS}?limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key. Please check and try again.' };
    }

    // Other errors (rate limit, server error) - we'll allow saving but warn
    console.warn('API key validation returned unexpected status:', response.status);
    return { valid: true }; // Allow saving, might be temporary issue
  } catch (error) {
    console.error('Error validating API key:', error);
    // Network error - allow saving, might be temporary
    return { valid: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { accountId, apiKey } = await request.json();

    if (!accountId || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate the API key before saving
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('accounts')
      .update({ farcaster_api_key: apiKey } as any)
      .eq('id', accountId);

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
