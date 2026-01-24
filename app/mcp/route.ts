import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, apikey, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function getMcpUpstreamUrl(): string {
  const override = process.env.MCP_FUNCTION_URL;
  if (override) return override;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL for MCP proxy.');
  }
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mcp-server`;
}

function getResourceMetadataUrl(request: NextRequest): string {
  const origin = new URL(request.url).origin;
  return new URL('/.well-known/oauth-protected-resource', origin).toString();
}

function getAuthChallengeHeaders(request: NextRequest): HeadersInit {
  const resourceMetadataUrl = getResourceMetadataUrl(request);
  return {
    ...corsHeaders,
    'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
  };
}

function buildProxyHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  return headers;
}

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const upstreamUrl = getMcpUpstreamUrl();
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: buildProxyHeaders(request),
    body,
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'invalid_request', error_description: 'MCP endpoint requires POST' },
    { status: 401, headers: getAuthChallengeHeaders(request) }
  );
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 401, headers: getAuthChallengeHeaders(request) });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
    },
  });
}
