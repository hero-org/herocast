/**
 * Follow handlers for the Farcaster Signing Service
 * Handles follow and unfollow operations
 */

import type { AuthResult } from '../lib/types.ts';
import { FollowRequestSchema, validateRequest } from '../lib/validate.ts';
import { getAccountForSigning } from '../lib/accounts.ts';
import { signAndSubmitFollow, removeFollow } from '../lib/sign.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, handleError } from '../lib/errors.ts';

/**
 * Handle POST /follow - Follow a user
 */
export async function handlePostFollow(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId, supabaseClient } = authResult;
  let accountId: string | undefined;

  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedRequest = validateRequest(FollowRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { target_fid: targetFid } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, userId);

    // Sign and submit the follow
    const hash = await signAndSubmitFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
    });

    // Log success to audit
    await logSigningAction({
      supabaseClient,
      accountId,
      userId,
      action: 'follow',
      success: true,
    });

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
    if (accountId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId,
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
  const { userId, supabaseClient } = authResult;
  let accountId: string | undefined;

  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedRequest = validateRequest(FollowRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { target_fid: targetFid } = validatedRequest;

    // Get account for signing
    const signingAccount = await getAccountForSigning(supabaseClient, accountId, userId);

    // Remove the follow (unfollow)
    const hash = await removeFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
    });

    // Log success to audit
    await logSigningAction({
      supabaseClient,
      accountId,
      userId,
      action: 'unfollow',
      success: true,
    });

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
    if (accountId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId,
        action: 'unfollow',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}
