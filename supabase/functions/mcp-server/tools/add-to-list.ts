import { z } from 'zod';
import { MAX_USERS_PER_LIST } from '../lib/constants.ts';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const AddToListSchema = z.object({
  list_id: z.string().uuid(),
  fids: z.array(z.string()).min(1).max(100),
  display_names: z.record(z.string(), z.string()).optional(),
});

type AddToListInput = z.infer<typeof AddToListSchema>;

type ListRow = {
  id: string;
  name: string;
  type: 'fids' | 'search' | 'auto_interaction';
  contents: Record<string, unknown>;
};

export const addToListToolDefinition: ToolDefinition = {
  name: 'add_to_list',
  description: 'Add user(s) to a FID list.',
  inputSchema: {
    type: 'object',
    properties: {
      list_id: { type: 'string', description: 'UUID of the list' },
      fids: { type: 'array', items: { type: 'string' }, description: 'FIDs to add (1-100)' },
      display_names: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Optional mapping of FID to display name',
      },
    },
    required: ['list_id', 'fids'],
  },
};

export async function addToListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: AddToListInput;
  try {
    parsed = AddToListSchema.parse(input);
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
          text: JSON.stringify({ error: 'Can only add users to FID lists', code: 'LIST_TYPE_MISMATCH' }),
        },
      ],
      isError: true,
    };
  }

  // Get current FIDs
  const currentFids: string[] = Array.isArray(list.contents.fids) ? (list.contents.fids as string[]) : [];
  const currentFidSet = new Set(currentFids);

  // Separate new FIDs from already present ones
  const added: string[] = [];
  const alreadyInList: string[] = [];

  for (const fid of parsed.fids) {
    if (currentFidSet.has(fid)) {
      alreadyInList.push(fid);
    } else {
      added.push(fid);
      currentFidSet.add(fid);
    }
  }

  // Check limit
  const newTotal = currentFidSet.size;
  if (newTotal > MAX_USERS_PER_LIST) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `Adding ${added.length} users would exceed the limit of ${MAX_USERS_PER_LIST} users per list (current: ${currentFids.length})`,
            code: 'LIST_LIMIT_EXCEEDED',
          }),
        },
      ],
      isError: true,
    };
  }

  // Build new contents
  const newFids = [...currentFids, ...added];
  const currentDisplayNames = (list.contents.displayNames as Record<string, string>) ?? {};
  const newDisplayNames = { ...currentDisplayNames, ...(parsed.display_names ?? {}) };

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
          added,
          already_in_list: alreadyInList,
          list_id: parsed.list_id,
          new_count: newFids.length,
        }),
      },
    ],
  };
}
