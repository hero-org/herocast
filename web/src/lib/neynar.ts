// SERVER-ONLY. Single source of truth for the Neynar API key, with a legacy-name
// fallback so a fork can reuse an existing herocast .env unchanged: all 31 current
// Next API routes (and src/common/helpers/farcaster.ts) read it as
// `NEXT_PUBLIC_NEYNAR_API_KEY`. The Phase-3 route ports should call this helper rather
// than reading the key directly.
import { serverEnv } from '@/lib/env';

export function getNeynarApiKey(): string {
  return serverEnv('NEYNAR_API_KEY') || serverEnv('NEXT_PUBLIC_NEYNAR_API_KEY');
}
