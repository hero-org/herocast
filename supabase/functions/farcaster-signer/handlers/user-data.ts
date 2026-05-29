/**
 * User data handlers for the Farcaster Signing Service
 * Handles profile updates (username, display name, bio, pfp)
 */

import { getAccountForSigning } from '../lib/accounts.ts';
import { logSigningAction } from '../lib/audit.ts';
import { corsHeaders, extractErrorCode, handleError } from '../lib/errors.ts';
import type { HubProvider } from '../lib/hubs.ts';
import { signAndSubmitUserData } from '../lib/sign.ts';
import type { AuthResult } from '../lib/types.ts';
import { getUserFarcasterProvider } from '../../_shared/userPreferences.ts';
import { UserDataRequestSchema, validateRequest } from '../lib/validate.ts';

/**
 * Handle POST /user-data - Update user data in Farcaster
 */
export async function handlePostUserData(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId: authUserId, supabaseClient, source } = authResult;
  const auditSource = source ?? 'user';
  let accountId: string | undefined;
  let auditUserId: string | undefined = authUserId;
  let provider: HubProvider = 'neynar';

  try {
    const body = await req.json();
    const validatedRequest = validateRequest(UserDataRequestSchema, body);

    accountId = validatedRequest.account_id;
    const { type, value } = validatedRequest;

    const signingAccount = await getAccountForSigning(supabaseClient, accountId, authUserId);
    auditUserId = signingAccount.userId;

    // Read the user-level Hub provider preference (default 'neynar').
    provider = await getUserFarcasterProvider(supabaseClient, signingAccount.userId);

    const hash = await signAndSubmitUserData({
      fid: signingAccount.fid,
      privateKey: signingAccount.privateKey,
      type,
      value,
      provider,
    });

    if (auditUserId) {
      await logSigningAction({
        supabaseClient,
        accountId,
        userId: auditUserId,
        actorUserId: authUserId,
        source: auditSource,
        provider,
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
        actorUserId: authUserId,
        source: auditSource,
        provider,
        action: 'user_data',
        success: false,
        errorCode: extractErrorCode(error),
      });
    }

    return handleError(error);
  }
}
