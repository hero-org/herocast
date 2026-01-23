/**
 * Follow handlers for the Farcaster Signing Service
 * Handles follow and unfollow operations
 */

import type { AuthResult } from '../lib/types.ts';
import { FollowRequestSchema, validateRequest } from '../lib/validate.ts';
import { getAccountForSigning } from '../lib/accounts.ts';
import { signAndSubmitFollow, removeFollow } from '../lib/sign.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, handleError, InvalidRequestError } from '../lib/errors.ts';

/**
 * Handle POST /follow - Follow a user
 */
export async function handlePostFollow(req: Request, authResult: AuthResult): Promise<Response> {
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
    const validatedRequest = validateRequest(FollowRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { target_fid: targetFid } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    // Sign and submit the follow
    const hash = await signAndSubmitFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'follow',
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
        action: 'follow',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}

/**
 * Handle DELETE /follow - Unfollow a user
 */
export async function handleDeleteFollow(req: Request, authResult: AuthResult): Promise<Response> {
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
    const validatedRequest = validateRequest(FollowRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { target_fid: targetFid } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    // Remove the follow (unfollow)
    const hash = await removeFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'unfollow',
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
        action: 'unfollow',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}
