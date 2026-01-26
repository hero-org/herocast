import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const ListListsSchema = z.object({
  type: z.enum(['fids', 'search', 'auto_interaction']).optional(),
});

type ListListsInput = z.infer<typeof ListListsSchema>;

type ListRow = {
  id: string;
  name: string;
  type: 'fids' | 'search' | 'auto_interaction';
  contents: Record<string, unknown>;
  idx: number;
};

export const listListsToolDefinition: ToolDefinition = {
  name: 'list_lists',
  description: 'Get all lists for the authenticated user (metadata only, no contents).',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['fids', 'search', 'auto_interaction'],
        description: 'Filter by list type (optional)',
      },
    },
  },
};

function getListCount(contents: Record<string, unknown>, type: string): number {
  if (type === 'fids' || type === 'auto_interaction') {
    const fids = contents.fids;
    return Array.isArray(fids) ? fids.length : 0;
  }
  // For search lists, count is not applicable
  return 0;
}

export async function listListsTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: ListListsInput;
  try {
    parsed = ListListsSchema.parse(input ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient } = auth;

  let query = supabaseClient.from('list').select('id, name, type, contents, idx').order('idx', { ascending: true });

  if (parsed.type) {
    query = query.eq('type', parsed.type);
  }

  const { data, error } = await query;

  if (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'LIST_QUERY_FAILED' }) }],
      isError: true,
    };
  }

  const lists = ((data as ListRow[] | null) ?? []).map((list) => ({
    id: list.id,
    name: list.name,
    type: list.type,
    count: getListCount(list.contents, list.type),
    idx: list.idx,
  }));

  return {
    content: [{ type: 'text', text: JSON.stringify({ lists }) }],
  };
}
