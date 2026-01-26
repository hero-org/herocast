import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const DeleteListSchema = z.object({
  list_id: z.string().uuid(),
});

type DeleteListInput = z.infer<typeof DeleteListSchema>;

export const deleteListToolDefinition: ToolDefinition = {
  name: 'delete_list',
  description: 'Delete a list.',
  inputSchema: {
    type: 'object',
    properties: {
      list_id: { type: 'string', description: 'UUID of the list to delete' },
    },
    required: ['list_id'],
  },
};

export async function deleteListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: DeleteListInput;
  try {
    parsed = DeleteListSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient } = auth;

  // Check if the list exists first
  const { data: existingList, error: fetchError } = await supabaseClient
    .from('list')
    .select('id')
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

  const { error } = await supabaseClient.from('list').delete().eq('id', parsed.list_id);

  if (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'LIST_DELETE_FAILED' }) }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ deleted: true, list_id: parsed.list_id }),
      },
    ],
  };
}
