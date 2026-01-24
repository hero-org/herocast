import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAuthUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL for MCP auth discovery.');
  }
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

function getResourceUrl(request: NextRequest): string {
  const origin = new URL(request.url).origin;
  return `${origin}/mcp`;
}

export async function GET(request: NextRequest) {
  try {
    const resource = getResourceUrl(request);
    const authServer = getSupabaseAuthUrl();

    const payload = {
      resource,
      authorization_servers: [authServer],
      bearer_methods_supported: ['header'],
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build MCP resource metadata';
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, apikey, x-idempotency-key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
