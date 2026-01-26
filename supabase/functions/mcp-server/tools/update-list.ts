import { z } from 'zod';
import { MAX_USERS_PER_LIST } from '../lib/constants.ts';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const UpdateListSchema = z.object({
  list_id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  fids: z.array(z.string()).max(MAX_USERS_PER_LIST).optional(),
  term: z.string().min(1).optional(),
});

type UpdateListInput = z.infer<typeof UpdateListSchema>;

type ListRow = {
  id: string;
  name: string;
  type: 'fids' | 'search' | 'auto_interaction';
  contents: Record<string, unknown>;
  idx: number;
};

export const updateListToolDefinition: ToolDefinition = {
  name: 'update_list',
  description: 'Update a list name or replace its contents.',
  inputSchema: {
    type: 'object',
    properties: {
      list_id: { type: 'string', description: 'UUID of the list to update' },
      name: { type: 'string', description: 'New name for the list (optional)' },
      fids: { type: 'array', items: { type: 'string' }, description: 'Replace all FIDs (FID lists only)' },
      term: { type: 'string', description: 'New search term (search lists only)' },
    },
    required: ['list_id'],
  },
};

export async function updateListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: UpdateListInput;
  try {
    parsed = UpdateListSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient } = auth;

  // Fetch the existing list
  const { data: existingList, error: fetchError } = await supabaseClient
    .from('list')
    .select('id, name, type, contents, idx')
    .eq('id', parsed.list_id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'List not found', code: 'LIST_NOT_FOUND' }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: fetchError.message, code: 'LIST_QUERY_FAILED' }) }],
      isError: true,
    };
  }

  const list = existingList as ListRow;

  // Validate type-specific operations
  if (parsed.fids !== undefined && list.type !== 'fids') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Cannot update fids on a non-FID list', code: 'LIST_TYPE_MISMATCH' }),
        },
      ],
      isError: true,
    };
  }

  if (parsed.term !== undefined && list.type !== 'search') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Cannot update term on a non-search list', code: 'LIST_TYPE_MISMATCH' }),
        },
      ],
      isError: true,
    };
  }

  if (list.type === 'auto_interaction') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Cannot update auto_interaction lists via MCP',
            code: 'LIST_TYPE_MISMATCH',
          }),
        },
      ],
      isError: true,
    };
  }

  // Build the update
  const updates: Record<string, unknown> = {};

  if (parsed.name !== undefined) {
    updates.name = parsed.name;
  }

  if (parsed.fids !== undefined) {
    const newContents = { ...list.contents, fids: parsed.fids };
    updates.contents = newContents;
  }

  if (parsed.term !== undefined) {
    const newContents = { ...list.contents, term: parsed.term };
    updates.contents = newContents;
  }

  if (Object.keys(updates).length === 0) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'No updates provided', code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { data, error } = await supabaseClient
    .from('list')
    .update(updates)
    .eq('id', parsed.list_id)
    .select('id, name, type, idx')
    .single();

  if (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'LIST_UPDATE_FAILED' }) }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          list: {
            id: data.id,
            name: data.name,
            type: data.type,
            idx: data.idx,
          },
        }),
      },
    ],
  };
}
