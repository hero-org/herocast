export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, apikey, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function getResourceMetadataUrl(): string | null {
  const resourceUrl = Deno.env.get('MCP_RESOURCE_URL');
  if (!resourceUrl) {
    return null;
  }
  try {
    return new URL('/.well-known/oauth-protected-resource', resourceUrl).toString();
  } catch {
    return null;
  }
}

export function getAuthChallengeHeaders(scope?: string): Record<string, string> {
  const resourceMetadataUrl = getResourceMetadataUrl();
  if (!resourceMetadataUrl) {
    return {};
  }

  const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
  if (scope) {
    parts.push(`scope="${scope}"`);
  }

  return {
    'WWW-Authenticate': parts.join(', '),
  };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function jsonRpcError(
  id: number | string | null,
  code: number,
  message: string,
  status = 400,
  data?: Record<string, unknown>,
  headers: Record<string, string> = {}
): Response {
  const errorPayload: Record<string, unknown> = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };

  return jsonResponse(errorPayload, status, headers);
}

export function jsonRpcResult(
  id: number | string | null | undefined,
  result: unknown,
  headers: Record<string, string> = {}
): Response {
  if (id === undefined) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonResponse(
    {
      jsonrpc: '2.0',
      id,
      result,
    },
    200,
    headers
  );
}

export function noContentResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
