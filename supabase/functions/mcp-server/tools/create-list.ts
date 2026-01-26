import { z } from 'zod';
import { MAX_USERS_PER_LIST } from '../lib/constants.ts';
import type { AuthContext, ToolDefinition, ToolResult } from '../lib/types.ts';

const CreateListSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: z.enum(['fids', 'search']),
    fids: z.array(z.string()).max(MAX_USERS_PER_LIST).optional(),
    term: z.string().min(1).optional(),
    filter_channel_id: z.string().optional(),
    filter_interval: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'fids') {
        return true; // fids is optional, can be empty list
      }
      if (data.type === 'search') {
        return !!data.term;
      }
      return true;
    },
    { message: 'Search lists require a term' }
  );

type CreateListInput = z.infer<typeof CreateListSchema>;

export const createListToolDefinition: ToolDefinition = {
  name: 'create_list',
  description: 'Create a new FID list or search list.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the list' },
      type: { type: 'string', enum: ['fids', 'search'], description: 'Type of list (fids or search)' },
      fids: { type: 'array', items: { type: 'string' }, description: 'Initial FIDs for FID lists (optional)' },
      term: { type: 'string', description: 'Search term (required for search lists)' },
      filter_channel_id: { type: 'string', description: 'Channel ID filter for search lists' },
      filter_interval: { type: 'string', description: 'Time interval filter for search lists' },
    },
    required: ['name', 'type'],
  },
};

export async function createListTool(auth: AuthContext, input: unknown): Promise<ToolResult> {
  let parsed: CreateListInput;
  try {
    parsed = CreateListSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  const { supabaseClient, userId } = auth;

  // Get the next idx value
  const { data: maxIdxData } = await supabaseClient
    .from('list')
    .select('idx')
    .order('idx', { ascending: false })
    .limit(1)
    .single();

  const nextIdx = maxIdxData?.idx != null ? (maxIdxData.idx as number) + 1 : 0;

  // Build contents based on type
  let contents: Record<string, unknown>;
  if (parsed.type === 'fids') {
    contents = {
      fids: parsed.fids ?? [],
    };
  } else {
    contents = {
      term: parsed.term!,
      filters: {
        ...(parsed.filter_channel_id && { channelId: parsed.filter_channel_id }),
        ...(parsed.filter_interval && { interval: parsed.filter_interval }),
      },
    };
  }

  const { data, error } = await supabaseClient
    .from('list')
    .insert({
      user_id: userId,
      name: parsed.name,
      type: parsed.type,
      contents,
      idx: nextIdx,
    })
    .select('id, name, type, idx')
    .single();

  if (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'LIST_CREATE_FAILED' }) }],
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
