import { z } from 'zod';
import { fetchUserByFid, fetchUserByUsername, formatUserFull } from '../lib/neynar.ts';
import type { ToolDefinition, ToolResult } from '../lib/types.ts';

const GetUserSchema = z
  .object({
    fid: z.number().int().positive().optional(),
    username: z.string().min(1).optional(),
  })
  .refine((data) => data.fid || data.username, {
    message: 'Either fid or username is required',
  });

type GetUserInput = z.infer<typeof GetUserSchema>;

export const getUserToolDefinition: ToolDefinition = {
  name: 'get_user',
  description: 'Get a Farcaster user profile by FID or username.',
  inputSchema: {
    type: 'object',
    properties: {
      fid: { type: 'number', description: 'Farcaster ID of the user' },
      username: { type: 'string', description: 'Farcaster username (with or without @)' },
    },
  },
};

export async function getUserTool(input: unknown): Promise<ToolResult> {
  let parsed: GetUserInput;
  try {
    parsed = GetUserSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid parameters';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'INVALID_PARAMS' }) }],
      isError: true,
    };
  }

  try {
    let user;
    if (parsed.fid) {
      user = await fetchUserByFid(parsed.fid);
    } else if (parsed.username) {
      user = await fetchUserByUsername(parsed.username);
    }

    if (!user) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }) }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ user: formatUserFull(user) }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, code: 'NEYNAR_API_ERROR' }) }],
      isError: true,
    };
  }
}
