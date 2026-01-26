import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const GetListSchema = z.object({
  list_id: z.string().uuid(),
});

type GetListInput = z.infer<typeof GetListSchema>;

type ListRow = {
  id: string;
  name: string;
  type: 'fids' | 'search' | 'auto_interaction';
  contents: Record<string, unknown>;
  idx: number;
};

export const getListToolDefinition: ToolDefinition = {
  name: 'get_list',
  description: 'Get a specific list with full contents.',
  inputSchema: {
    type: 'object',
    properties: {
      list_id: { type: 'string', description: 'UUID of the list to retrieve' },
    },
    required: ['list_id'],
  },
};

export async function getListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: GetListInput;
  try {
    parsed = GetListSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient } = auth;

  const { data, error } = await supabaseClient
    .from('list')
    .select('id, name, type, contents, idx')
    .eq('id', parsed.list_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'List not found', code: 'LIST_NOT_FOUND' }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'LIST_QUERY_FAILED' }) }],
      isError: true,
    };
  }

  const list = data as ListRow;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          list: {
            id: list.id,
            name: list.name,
            type: list.type,
            contents: list.contents,
            idx: list.idx,
          },
        }),
      },
    ],
  };
}
