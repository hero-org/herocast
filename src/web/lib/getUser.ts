// Client-importable server-fn wrapper for the Supabase read path. The migration probe
// route imports `getUserFn` from here directly, so this module MUST stay in the client
// graph — the Start compiler replaces the handler body (and tree-shakes its server-only
// top-level imports: `getRequest`, the `supabase/server.server` env helpers, and the
// `getUser.server` implementation) with an RPC stub in the client bundle.
//
// The actual implementation (`getUserFromRequest`) and the Supabase server client live
// in the `.server.ts` siblings so they are deny-listed out of the client deterministically
// (see getUser.server.ts). Only the server fn + the erased `GetUserResult` type cross the
// boundary into this client-importable module.
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { type GetUserResult, getUserFromRequest } from '@/web/lib/getUser.server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/web/lib/supabase/server.server';

export type { GetUserResult };

/**
 * Server fn wrapper consumed by the migration probe route. Reads env INSIDE the handler
 * (module-scope `cloudflare:workers` reads are undefined on workerd) and the request via
 * `getRequest()` (the replacement for the removed `getWebRequest`, per
 * @tanstack/react-start >= 1.168).
 */
export const getUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  return getUserFromRequest(request, getSupabaseUrl(), getSupabaseAnonKey());
});
