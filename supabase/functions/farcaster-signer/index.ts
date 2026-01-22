/**
 * Farcaster Signing Service - Main Router
 *
 * This edge function handles authenticated requests to sign and submit
 * Farcaster protocol messages (casts, reactions, follows) on behalf of users.
 *
 * Routes:
 *   POST /cast     - Create a new cast
 *   DELETE /cast   - Delete an existing cast
 *   POST /reaction - Add a reaction (like/recast)
 *   DELETE /reaction - Remove a reaction
 *   POST /follow   - Follow a user
 *   DELETE /follow - Unfollow a user
 */

import { corsHeaders, handleError } from './lib/errors.ts';
import { authenticateRequest } from './lib/auth.ts';
import { handlePostCast, handleDeleteCast } from './handlers/cast.ts';
import { handlePostReaction, handleDeleteReaction } from './handlers/reaction.ts';
import { handlePostFollow, handleDeleteFollow } from './handlers/follow.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract path (remove function prefix - handles both local and deployed routing)
    const url = new URL(req.url);
    // Edge runtime may strip /functions/v1/ prefix, so handle both formats
    const path =
      url.pathname.replace(/^\/functions\/v1\/farcaster-signer/, '').replace(/^\/farcaster-signer/, '') || '/';

    // Authenticate request before routing
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader);

    // Route to appropriate handler based on method and path
    switch (`${req.method} ${path}`) {
      case 'POST /cast':
        return await handlePostCast(req, authResult);

      case 'DELETE /cast':
        return await handleDeleteCast(req, authResult);

      case 'POST /reaction':
        return await handlePostReaction(req, authResult);

      case 'DELETE /reaction':
        return await handleDeleteReaction(req, authResult);

      case 'POST /follow':
        return await handlePostFollow(req, authResult);

      case 'DELETE /follow':
        return await handleDeleteFollow(req, authResult);

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Route not found: ${req.method} ${path}`,
            },
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
    }
  } catch (error) {
    return handleError(error);
  }
});
