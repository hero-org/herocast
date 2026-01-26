/**
 * Herocast MCP Server (Supabase Edge Function)
 *
 * Implements MCP JSON-RPC methods:
 * - initialize
 * - tools/list
 * - tools/call
 */

import { authenticateRequest } from './lib/auth.ts';
import {
  corsHeaders,
  getAuthChallengeHeaders,
  jsonResponse,
  jsonRpcError,
  jsonRpcResult,
  noContentResponse,
} from './lib/errors.ts';
import type { JsonRpcRequest } from './lib/types.ts';
import { getCastsTool, getCastsToolDefinition } from './tools/get-casts.ts';
import { listAccountsTool, listAccountsToolDefinition } from './tools/list-accounts.ts';
import { postCastTool, postCastToolDefinition } from './tools/post-cast.ts';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'herocast-mcp';
const SERVER_VERSION = '1.0.0';
const MCP_SESSION_HEADER = 'Mcp-Session-Id';

const toolDefinitions = [postCastToolDefinition, listAccountsToolDefinition, getCastsToolDefinition];

function getSessionId(req: Request): string {
  return req.headers.get('mcp-session-id') || crypto.randomUUID();
}

function parseJsonRpcRequest(body: unknown): JsonRpcRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const maybeRequest = body as Record<string, unknown>;
  if (maybeRequest.jsonrpc !== '2.0' || typeof maybeRequest.method !== 'string') {
    return null;
  }

  return {
    jsonrpc: '2.0',
    id: maybeRequest.id as JsonRpcRequest['id'],
    method: maybeRequest.method,
    params: maybeRequest.params,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return jsonResponse(
      { error: 'invalid_request', error_description: 'MCP endpoint requires POST' },
      401,
      getAuthChallengeHeaders()
    );
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: invalid JSON', 400);
  }

  const rpcRequest = parseJsonRpcRequest(body);
  if (!rpcRequest) {
    return jsonRpcError(null, -32600, 'Invalid Request', 400);
  }

  const { id, method, params } = rpcRequest;

  if (method === 'notifications/initialized') {
    return noContentResponse();
  }

  let auth;
  try {
    auth = await authenticateRequest(req.headers.get('Authorization'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return jsonRpcError(id ?? null, -32001, message, 401, undefined, getAuthChallengeHeaders());
  }

  switch (method) {
    case 'initialize': {
      const sessionId = getSessionId(req);
      return jsonRpcResult(
        id ?? null,
        {
          protocolVersion: MCP_PROTOCOL_VERSION,
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        },
        { [MCP_SESSION_HEADER]: sessionId }
      );
    }

    case 'tools/list': {
      return jsonRpcResult(id ?? null, { tools: toolDefinitions });
    }

    case 'tools/call': {
      if (!params || typeof params !== 'object') {
        return jsonRpcResult(id ?? null, {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Missing params', code: 'INVALID_PARAMS' }) }],
          isError: true,
        });
      }

      const { name, arguments: toolArguments } = params as Record<string, unknown>;
      if (typeof name !== 'string') {
        return jsonRpcResult(id ?? null, {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Missing tool name', code: 'INVALID_PARAMS' }) }],
          isError: true,
        });
      }

      if (name === postCastToolDefinition.name) {
        const result = await postCastTool(auth, toolArguments);
        return jsonRpcResult(id ?? null, result);
      }

      if (name === listAccountsToolDefinition.name) {
        const result = await listAccountsTool(auth.supabaseClient, auth.userId);
        return jsonRpcResult(id ?? null, result);
      }

      if (name === getCastsToolDefinition.name) {
        const result = await getCastsTool(auth, toolArguments);
        return jsonRpcResult(id ?? null, result);
      }

      return jsonRpcResult(id ?? null, {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}`, code: 'TOOL_NOT_FOUND' }) }],
        isError: true,
      });
    }

    default:
      return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`, 404);
  }
});
