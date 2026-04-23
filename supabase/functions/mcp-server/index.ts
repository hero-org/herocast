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
import { assertScope, isScopeInsufficientError, type McpScope } from './lib/scopes.ts';
import type { JsonRpcRequest, ToolDefinition, ToolHandler } from './lib/types.ts';
import { addToListTool, addToListToolDefinition } from './tools/add-to-list.ts';
import { createListTool, createListToolDefinition } from './tools/create-list.ts';
import { deleteListTool, deleteListToolDefinition } from './tools/delete-list.ts';
import { getCastsTool, getCastsToolDefinition } from './tools/get-casts.ts';
import { getListTool, getListToolDefinition } from './tools/get-list.ts';
import { getUserTool, getUserToolDefinition } from './tools/get-user.ts';
import { listAccountsTool, listAccountsToolDefinition } from './tools/list-accounts.ts';
import { listListsTool, listListsToolDefinition } from './tools/list-lists.ts';
import { postCastTool, postCastToolDefinition } from './tools/post-cast.ts';
import { removeFromListTool, removeFromListToolDefinition } from './tools/remove-from-list.ts';
import { searchUsersTool, searchUsersToolDefinition } from './tools/search-users.ts';
import { updateListTool, updateListToolDefinition } from './tools/update-list.ts';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'herocast-mcp';
const SERVER_VERSION = '1.0.0';
const MCP_SESSION_HEADER = 'Mcp-Session-Id';

type Tool = { definition: ToolDefinition; handler: ToolHandler; requiredScope: McpScope };

const tools: Tool[] = [
  { definition: postCastToolDefinition, handler: postCastTool, requiredScope: 'write:cast' },
  {
    definition: listAccountsToolDefinition,
    handler: (auth) => listAccountsTool(auth.supabaseClient, auth.userId),
    requiredScope: 'read:accounts',
  },
  { definition: getCastsToolDefinition, handler: getCastsTool, requiredScope: 'read:casts' },
  { definition: getUserToolDefinition, handler: (_auth, args) => getUserTool(args), requiredScope: 'read:accounts' },
  {
    definition: searchUsersToolDefinition,
    handler: (_auth, args) => searchUsersTool(args),
    requiredScope: 'read:accounts',
  },
  { definition: listListsToolDefinition, handler: listListsTool, requiredScope: 'manage:lists' },
  { definition: getListToolDefinition, handler: getListTool, requiredScope: 'manage:lists' },
  { definition: createListToolDefinition, handler: createListTool, requiredScope: 'manage:lists' },
  { definition: updateListToolDefinition, handler: updateListTool, requiredScope: 'manage:lists' },
  { definition: deleteListToolDefinition, handler: deleteListTool, requiredScope: 'manage:lists' },
  { definition: addToListToolDefinition, handler: addToListTool, requiredScope: 'manage:lists' },
  { definition: removeFromListToolDefinition, handler: removeFromListTool, requiredScope: 'manage:lists' },
];

type ToolEntry = { handler: ToolHandler; requiredScope: McpScope };
const toolMap = new Map<string, ToolEntry>(
  tools.map((t) => [t.definition.name, { handler: t.handler, requiredScope: t.requiredScope }])
);
const toolDefinitions = tools.map((t) => t.definition);

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
    const hasAuthHeader = !!req.headers.get('Authorization');
    // Do NOT echo any portion of the bearer token (length/prefix/slice) —
    // that was historically used for debugging but leaks key material into
    // client-facing responses and logs. Only a boolean presence flag is safe.
    return jsonRpcError(
      id ?? null,
      -32001,
      message,
      401,
      { debug: { hasAuthHeader } },
      getAuthChallengeHeaders()
    );
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

      const entry = toolMap.get(name);
      if (entry) {
        try {
          assertScope(auth.scopes, entry.requiredScope);
        } catch (scopeErr) {
          if (isScopeInsufficientError(scopeErr)) {
            return jsonRpcError(id ?? null, -32603, scopeErr.message, 403, {
              code: 'scope_insufficient',
              required: scopeErr.required,
            });
          }
          throw scopeErr;
        }
        const result = await entry.handler(auth, toolArguments);
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
