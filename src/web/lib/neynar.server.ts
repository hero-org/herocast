// SERVER-ONLY. Resolves the Neynar API key from the runtime Worker env.
//
// herocast's live trending route reads `process.env.NEXT_PUBLIC_NEYNAR_API_KEY`
// (see app/api/feeds/trending/route.ts). On the TanStack/Cloudflare side the key is
// a runtime Worker secret. We prefer the un-prefixed `NEYNAR_API_KEY` (the Worker
// secret name) and fall back to the legacy `NEXT_PUBLIC_NEYNAR_API_KEY` so a single
// .dev.vars / secret set works for both the Next app and this slice.
//
// Read INSIDE the handler that calls this — `serverEnv` reads `cloudflare:workers`
// env, which is undefined at module scope on workerd.
//
// This file uses the `.server.ts` naming convention: import-protection's DEFAULT
// client deny-rule (`**/*.server.*`) mocks it out of the client bundle deterministically
// (the runtime-ordered `server-only` marker races in Rollup `build` mode and is not
// used). Consistent with env.server.ts / supabase/server.server.ts.
import { serverEnv } from '@/web/lib/env.server';

/**
 * Returns the Neynar API key, or undefined if neither env var is set. Callers decide
 * whether an absent key is fatal (the probe renders an empty state instead of throwing).
 */
export function getNeynarApiKey(): string | undefined {
  return serverEnv('NEYNAR_API_KEY') ?? serverEnv('NEXT_PUBLIC_NEYNAR_API_KEY');
}
