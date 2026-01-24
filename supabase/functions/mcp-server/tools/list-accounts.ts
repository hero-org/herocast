import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolDefinition, ToolResult } from '../lib/types.ts';

type AccountRow = {
  id: string;
  name: string | null;
  platform_account_id: string | null;
  data: Record<string, unknown> | null;
  status: string | null;
};

export const listAccountsToolDefinition: ToolDefinition = {
  name: 'list_accounts',
  description: 'List connected Farcaster accounts for the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

function getAccountDisplayName(account: AccountRow): string | null {
  const data = account.data ?? {};
  const displayName = typeof data.display_name === 'string' ? data.display_name : data.displayName;
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName.trim();
  }
  return account.name?.trim() || null;
}

function getAccountUsername(account: AccountRow): string | null {
  const data = account.data ?? {};
  const username = typeof data.username === 'string' ? data.username : undefined;
  if (typeof username === 'string' && username.trim()) {
    return username.trim();
  }
  return account.name?.trim() || null;
}

export async function listAccountsTool(supabaseClient: SupabaseClient, userId: string): Promise<ToolResult> {
  const { data, error } = await supabaseClient
    .from('accounts')
    .select('id, name, platform_account_id, data, status')
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('display_order', { ascending: true, nullsLast: true })
    .order('created_at', { ascending: true });

  if (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message, code: 'ACCOUNT_QUERY_FAILED' }),
        },
      ],
      isError: true,
    };
  }

  const accounts = (data as AccountRow[] | null | undefined) ?? [];
  const payload = accounts
    .filter((account) => account.status === 'active')
    .map((account) => ({
      id: account.id,
      username: getAccountUsername(account),
      fid: account.platform_account_id ? Number(account.platform_account_id) : null,
      display_name: getAccountDisplayName(account),
    }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ accounts: payload }),
      },
    ],
  };
}
