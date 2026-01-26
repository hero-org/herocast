import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthContext = {
  supabaseClient: SupabaseClient;
  userId: string;
  token: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (auth: AuthContext, args: unknown) => Promise<ToolResult>;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
};
