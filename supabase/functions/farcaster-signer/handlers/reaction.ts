/**
 * Reaction handlers for the Farcaster Signing Service
 * Handles like and recast operations
 */

import { getAccountForSigning } from '../lib/accounts.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, handleError, InvalidRequestError } from '../lib/errors.ts';
import { removeReaction, signAndSubmitReaction } from '../lib/sign.ts';
import type { AuthResult } from '../lib/types.ts';
import { DeleteReactionRequestSchema, ReactionRequestSchema, validateRequest } from '../lib/validate.ts';

/**
 * Handle POST /reaction - Add a reaction (like or recast)
 */
export async function handlePostReaction(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient } = authResult;
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const validatedRequest = validateRequest(ReactionRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { type: reactionType, target } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    // Sign and submit the reaction
    const hash = await signAndSubmitReaction({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      type: reactionType,
      targetFid: target.fid,
      targetHash: target.hash,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: reactionType,
        success: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        hash,
        fid: signingAccount.fid,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Log failure to audit if we have an accountId
    if (accountId && auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'reaction',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}

/**
 * Handle DELETE /reaction - Remove a reaction (like or recast)
 */
export async function handleDeleteReaction(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient } = authResult;
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const validatedRequest = validateRequest(DeleteReactionRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { type: reactionType, target } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    // Remove the reaction
    const hash = await removeReaction({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      type: reactionType,
      targetFid: target.fid,
      targetHash: target.hash,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: `remove_${reactionType}`,
        success: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        hash,
        fid: signingAccount.fid,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Log failure to audit if we have an accountId
    if (accountId && auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'remove_reaction',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}
