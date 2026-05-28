/**
 * Follow handlers for the Farcaster Signing Service
 * Handles follow and unfollow operations
 */

import { getAccountForSigning } from '../lib/accounts.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, extractErrorCode, handleError, InvalidRequestError } from '../lib/errors.ts';
import type { HubProvider } from '../lib/hubs.ts';
import { removeFollow, signAndSubmitFollow } from '../lib/sign.ts';
import type { AuthResult } from '../lib/types.ts';
import { getUserFarcasterProvider } from '../../_shared/userPreferences.ts';
import { FollowRequestSchema, validateRequest } from '../lib/validate.ts';

/**
 * Handle POST /follow - Follow a user
 */
export async function handlePostFollow(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient, source } = authResult;
  const auditSource = source ?? 'user';
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;
  let provider: HubProvider = 'neynar';

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

    // Read the user-level Hub provider preference (default 'neynar').
    provider = await getUserFarcasterProvider(supabaseClient, signingAccount.userId);

    // Sign and submit the follow
    const hash = await signAndSubmitFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
      provider,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        actorUserId: authUserId,
        source: auditSource,
        provider,
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
        actorUserId: authUserId,
        source: auditSource,
        provider,
        action: 'follow',
        success: false,
        errorCode: extractErrorCode(error),
      });
    }

    return handleError(error);
  }
}

/**
 * Handle DELETE /follow - Unfollow a user
 */
export async function handleDeleteFollow(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient, source } = authResult;
  const auditSource = source ?? 'user';
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;
  let provider: HubProvider = 'neynar';

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

    // Read the user-level Hub provider preference (default 'neynar').
    provider = await getUserFarcasterProvider(supabaseClient, signingAccount.userId);

    // Remove the follow (unfollow)
    const hash = await removeFollow({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      targetFid,
      provider,
    });

    // Log success to audit
    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        actorUserId: authUserId,
        source: auditSource,
        provider,
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
        actorUserId: authUserId,
        source: auditSource,
        provider,
        action: 'unfollow',
        success: false,
        errorCode: extractErrorCode(error),
      });
    }

    return handleError(error);
  }
}
