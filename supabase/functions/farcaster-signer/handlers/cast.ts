/**
 * Cast handlers for the Farcaster Signing Service
 * Handles creating and deleting casts with idempotency support
 */

import { getAccountForSigning } from '../lib/accounts.ts';
import { logSigningAction } from '../lib/audit.ts';
import { resolveChannelToUrl } from '../lib/channels.ts';
import { corsHeaders, handleError, InvalidRequestError, SignerServiceError } from '../lib/errors.ts';
import { checkIdempotency, storeIdempotency } from '../lib/idempotency.ts';
import { removeCast, signAndSubmitCast } from '../lib/sign.ts';
import type { AuthResult } from '../lib/types.ts';
import {
  type CastRequest,
  CastRequestSchema,
  DeleteCastRequestSchema,
  ValidationError,
  validateRequest,
} from '../lib/validate.ts';

/**
 * Transform embeds from validation schema format (snake_case) to sign.ts format (camelCase)
 */
function transformEmbeds(
  embeds?: CastRequest['embeds']
): Array<{ url: string } | { castId: { fid: number; hash: string } }> | undefined {
  if (!embeds) return undefined;

  return embeds.map((embed) => {
    if ('url' in embed) {
      return { url: embed.url };
    }
    if ('cast_id' in embed) {
      return {
        castId: {
          fid: embed.cast_id.fid,
          hash: embed.cast_id.hash,
        },
      };
    }
    return embed as { url: string };
  });
}

/**
 * Creates a successful JSON response with CORS headers
 */
function successResponse(data: { success: true; hash: string; fid: number }): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle POST /cast - Create a new cast
 *
 * Flow:
 * 1. Parse JSON body
 * 2. Validate with CastRequestSchema
 * 3. If idempotency_key provided, check cache and return cached response if found
 * 4. If channel_id provided (and no parent_url), resolve to parent_url
 * 5. Get account for signing
 * 6. Sign and submit cast
 * 7. If idempotency_key provided, store result in cache
 * 8. Log to audit
 * 9. Return success response
 */
export async function handlePostCast(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient } = authResult;
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;

  try {
    // 1. Parse JSON body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    // 2. Validate with CastRequestSchema
    const validated = validateRequest(CastRequestSchema, body);
    accountId = validated.account_id;

    // 3. Get idempotency key from header (preferred) or body
    const idempotencyKey = req.headers.get('X-Idempotency-Key') || validated.idempotency_key;

    // 4. Check idempotency cache if key provided
    if (idempotencyKey) {
      const cached = await checkIdempotency(supabaseClient, accountId, idempotencyKey);

      if (cached.found) {
        // Return cached response
        if (cached.error) {
          // Previous request failed - return the same error
          return new Response(
            JSON.stringify({
              success: false,
              error: cached.error,
              code: 'IDEMPOTENCY_CONFLICT',
            }),
            {
              status: 409,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        if (cached.hash) {
          // Previous request succeeded - get account to return fid
          const account = await getAccountForSigning(supabaseClient, accountId, authUserId);
          return successResponse({
            success: true,
            hash: cached.hash,
            fid: account.fid,
          });
        }
      }
    }

    // 4. Resolve channel_id to parent_url if needed
    let parentUrl = validated.parent_url;
    if (validated.channel_id && !parentUrl) {
      parentUrl = await resolveChannelToUrl(validated.channel_id);
    }

    // 5. Get account for signing
    const account = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = account.userId;

    // 6. Sign and submit cast
    const hash = await signAndSubmitCast({
      fid: account.fid,
      privateKey: account.privateKey,
      text: validated.text,
      parentUrl,
      parentCastId: validated.parent_cast_id,
      embeds: transformEmbeds(validated.embeds),
      mentions: validated.mentions,
      mentionsPositions: validated.mentions_positions,
      castType: validated.cast_type,
    });

    // 8. Store idempotency result if key provided
    if (idempotencyKey) {
      await storeIdempotency(supabaseClient, accountId, idempotencyKey, hash);
    }

    // 8. Log to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'cast',
        success: true,
      });
    }

    // 9. Return success response
    return successResponse({
      success: true,
      hash,
      fid: account.fid,
    });
  } catch (error) {
    // Determine error code for audit logging
    let errorCode: string | undefined;
    if (error instanceof SignerServiceError) {
      errorCode = error.code;
    } else if (error instanceof ValidationError) {
      errorCode = error.code;
    } else {
      errorCode = 'INTERNAL_ERROR';
    }

    // Log failed action to audit if we have an account ID
    if (accountId && auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'cast',
        success: false,
        errorCode,
      });
    }

    // Store error in idempotency cache if applicable
    // Note: We need to re-parse the body to get idempotency_key
    // This is best-effort - if parsing fails, we skip storing
    if (accountId) {
      try {
        const bodyText = await req.clone().text();
        const parsed = JSON.parse(bodyText);
        if (parsed.idempotency_key) {
          await storeIdempotency(supabaseClient, accountId, parsed.idempotency_key, undefined, errorCode);
        }
      } catch {
        // Ignore errors when trying to store idempotency for failed requests
      }
    }

    return handleError(error);
  }
}

/**
 * Handle DELETE /cast - Delete an existing cast
 *
 * Flow:
 * 1. Parse JSON body
 * 2. Validate with DeleteCastRequestSchema
 * 3. Get account for signing
 * 4. Remove cast
 * 5. Log to audit
 * 6. Return success response
 */
export async function handleDeleteCast(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient } = authResult;
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;

  try {
    // 1. Parse JSON body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    // 2. Validate with DeleteCastRequestSchema
    const validated = validateRequest(DeleteCastRequestSchema, body);
    accountId = validated.account_id;

    // 3. Get account for signing
    const account = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = account.userId;

    // 4. Remove cast
    await removeCast({
      fid: account.fid,
      privateKey: account.privateKey,
      castHash: validated.cast_hash,
    });

    // 5. Log to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'remove_cast',
        success: true,
      });
    }

    // 6. Return success response
    return successResponse({
      success: true,
      hash: validated.cast_hash,
      fid: account.fid,
    });
  } catch (error) {
    // Determine error code for audit logging
    let errorCode: string | undefined;
    if (error instanceof SignerServiceError) {
      errorCode = error.code;
    } else if (error instanceof ValidationError) {
      errorCode = error.code;
    } else {
      errorCode = 'INTERNAL_ERROR';
    }

    // Log failed action to audit if we have an account ID
    if (accountId && auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'remove_cast',
        success: false,
        errorCode,
      });
    }

    return handleError(error);
  }
}
