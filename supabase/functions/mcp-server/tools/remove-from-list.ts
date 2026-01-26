import { z } from 'zod';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const RemoveFromListSchema = z.object({
  list_id: z.string().uuid(),
  fids: z.array(z.string()).min(1).max(100),
});

type RemoveFromListInput = z.infer<typeof RemoveFromListSchema>;

type ListRow = {
  id: string;
  name: string;
  type: 'fids' | 'search' | 'auto_interaction';
  contents: Record<string, unknown>;
};

export const removeFromListToolDefinition: ToolDefinition = {
  name: 'remove_from_list',
  description: 'Remove user(s) from a FID list.',
  inputSchema: {
    type: 'object',
    properties: {
      list_id: { type: 'string', description: 'UUID of the list' },
      fids: { type: 'array', items: { type: 'string' }, description: 'FIDs to remove (1-100)' },
    },
    required: ['list_id', 'fids'],
  },
};

export async function removeFromListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: RemoveFromListInput;
  try {
    parsed = RemoveFromListSchema.parse(input);
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
    .select('id, name, type, contents')
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

  // Validate list type
  if (list.type !== 'fids') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Can only remove users from FID lists', code: 'LIST_TYPE_MISMATCH' }),
        },
      ],
      isError: true,
    };
  }

  // Get current FIDs
  const currentFids: string[] = Array.isArray(list.contents.fids) ? (list.contents.fids as string[]) : [];
  const currentFidSet = new Set(currentFids);
  const fidsToRemove = new Set(parsed.fids);

  // Separate removed FIDs from not-in-list ones
  const removed: string[] = [];
  const notInList: string[] = [];

  for (const fid of parsed.fids) {
    if (currentFidSet.has(fid)) {
      removed.push(fid);
    } else {
      notInList.push(fid);
    }
  }

  // Build new FIDs list
  const newFids = currentFids.filter((fid) => !fidsToRemove.has(fid));

  // Also remove from displayNames
  const currentDisplayNames = (list.contents.displayNames as Record<string, string>) ?? {};
  const newDisplayNames = { ...currentDisplayNames };
  for (const fid of removed) {
    delete newDisplayNames[fid];
  }

  const newContents = {
    ...list.contents,
    fids: newFids,
    displayNames: newDisplayNames,
  };

  const { error } = await supabaseClient.from('list').update({ contents: newContents }).eq('id', parsed.list_id);

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
          removed,
          not_in_list: notInList,
          list_id: parsed.list_id,
          new_count: newFids.length,
        }),
      },
    ],
  };
}
