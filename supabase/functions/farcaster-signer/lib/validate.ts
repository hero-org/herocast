import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

// Error codes matching the spec
export const ErrorCodes = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
} as const;

// Validation error class
export class ValidationError extends Error {
  code: string;

  constructor(message: string, code: string = ErrorCodes.INVALID_MESSAGE) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

// Common schemas
const uuidSchema = z.string().uuid();

const hexHashSchema = z.string().regex(/^0x[a-fA-F0-9]+$/, 'Hash must start with 0x followed by hex characters');

const castIdSchema = z.object({
  fid: z.number().int().positive(),
  hash: hexHashSchema,
});

// Embed schemas
const urlEmbedSchema = z.object({
  url: z.string().url(),
});

const castIdEmbedSchema = z.object({
  cast_id: castIdSchema,
});

const embedSchema = z.union([urlEmbedSchema, castIdEmbedSchema]);

/**
 * Schema for cast signing requests
 *
 * Validates:
 * - account_id: required UUID
 * - text: required, 1-1024 characters
 * - channel_id: optional string (mutually exclusive with parent_url)
 * - parent_url: optional URL (mutually exclusive with channel_id)
 * - parent_cast_id: optional cast reference for replies
 * - embeds: optional array of URL or cast_id embeds, max 2
 * - idempotency_key: optional string for deduplication
 */
export const CastRequestSchema = z
  .object({
    account_id: uuidSchema,
    text: z.string().min(1, 'Text is required').max(1024, 'Text must not exceed 1024 characters'),
    channel_id: z.string().optional(),
    parent_url: z.string().url().optional(),
    parent_cast_id: castIdSchema.optional(),
    embeds: z.array(embedSchema).max(2, 'Maximum 2 embeds allowed').optional(),
    idempotency_key: z.string().optional(),
  })
  .refine((data) => !(data.channel_id && data.parent_url), {
    message: 'Use channel_id or parent_url, not both',
    path: ['channel_id'],
  });

export type CastRequest = z.infer<typeof CastRequestSchema>;

/**
 * Schema for reaction (like/recast) requests
 *
 * Validates:
 * - account_id: required UUID
 * - type: 'like' or 'recast'
 * - target: cast reference with fid and hash
 */
export const ReactionRequestSchema = z.object({
  account_id: uuidSchema,
  type: z.enum(['like', 'recast']),
  target: castIdSchema,
});

export type ReactionRequest = z.infer<typeof ReactionRequestSchema>;

/**
 * Schema for follow requests
 *
 * Validates:
 * - account_id: required UUID
 * - target_fid: required positive integer
 */
export const FollowRequestSchema = z.object({
  account_id: uuidSchema,
  target_fid: z.number().int().positive(),
});

export type FollowRequest = z.infer<typeof FollowRequestSchema>;

/**
 * Schema for cast deletion requests
 *
 * Validates:
 * - account_id: required UUID
 * - cast_hash: required hex hash string
 */
export const DeleteCastRequestSchema = z.object({
  account_id: uuidSchema,
  cast_hash: hexHashSchema,
});

export type DeleteCastRequest = z.infer<typeof DeleteCastRequestSchema>;

/**
 * Schema for reaction deletion requests
 * Same structure as ReactionRequestSchema
 *
 * Validates:
 * - account_id: required UUID
 * - type: 'like' or 'recast'
 * - target: cast reference with fid and hash
 */
export const DeleteReactionRequestSchema = z.object({
  account_id: uuidSchema,
  type: z.enum(['like', 'recast']),
  target: castIdSchema,
});

export type DeleteReactionRequest = z.infer<typeof DeleteReactionRequestSchema>;

/**
 * Validates request data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Unknown data to validate
 * @returns Parsed and typed data
 * @throws ValidationError with INVALID_MESSAGE code on failure
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message}`;
    });

    throw new ValidationError(`Invalid request: ${errors.join(', ')}`, ErrorCodes.INVALID_MESSAGE);
  }

  return result.data;
}
