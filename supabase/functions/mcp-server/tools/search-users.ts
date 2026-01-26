import { z } from 'zod';
import { formatUser, searchUsers } from '../lib/neynar.ts';
import type { ToolDefinition, ToolResult } from '../lib/types.ts';

const SearchUsersSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(25).default(10).optional(),
});

type SearchUsersInput = z.infer<typeof SearchUsersSchema>;

export const searchUsersToolDefinition: ToolDefinition = {
  name: 'search_users',
  description: 'Search for Farcaster users by query string.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (name, username, bio text)' },
      limit: { type: 'number', description: 'Number of results to return (1-25, default 10)' },
    },
    required: ['query'],
  },
};

export async function searchUsersTool(input: unknown): Promise<ToolResult> {
  let parsed: SearchUsersInput;
  try {
    parsed = SearchUsersSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  try {
    const limit = parsed.limit ?? 10;
    const users = await searchUsers(parsed.query, limit);

    return {
      content: [{ type: 'text', text: JSON.stringify({ users: users.map(formatUser) }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'NEYNAR_API_ERROR' }) }],
      isError: true,
    };
  }
}
