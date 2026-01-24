/**
 * User data handlers for the Farcaster Signing Service
 * Handles profile updates (username, display name, bio, pfp)
 */

import type { AuthResult } from '../lib/types.ts';
import { UserDataRequestSchema, validateRequest } from '../lib/validate.ts';
import { getAccountForSigning } from '../lib/accounts.ts';
import { signAndSubmitUserData } from '../lib/sign.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, handleError } from '../lib/errors.ts';

/**
 * Handle POST /user-data - Update user data in Farcaster
 */
export async function handlePostUserData(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient } = authResult;
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;

  try {
    const body = await req.json();
    const validatedRequest = validateRequest(UserDataRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { type, value } = validatedRequest;

    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    const hash = await signAndSubmitUserData({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      type,
      value,
    });

    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'user_data',
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
    if (accountId && auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        action: 'user_data',
        success: false,
        errorCode: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return handleError(error);
  }
}
