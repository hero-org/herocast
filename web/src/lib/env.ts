// SERVER-ONLY runtime config access.
//
// `cloudflare:workers` is a workerd virtual module — importing it from any
// client/browser module breaks the client build. Only import this file from
// server code (server fns, server route handlers, loaders running on the edge).
//
// On the edge `process.env` is unreliable (#754, commit eb7ff5f4), so the
// cloudflare:workers binding is the primary source; `process.env` (populated under
// nodejs_compat and from .dev.vars in local dev) is the fallback. Both were
// confirmed populated on real workerd by the Phase-0 spike.
import { env as cfEnv } from 'cloudflare:workers';

type EnvBag = Record<string, unknown> | undefined;

/** Read a server var/secret. Returns '' when unset. */
export function serverEnv(key: string): string {
  const fromBinding = (cfEnv as EnvBag)?.[key];
  if (fromBinding != null && fromBinding !== '') return String(fromBinding);
  const fromProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key];
  return fromProcess ?? '';
}

/** Read a required server var/secret; throws a forkability-friendly error if unset. */
export function requireServerEnv(key: string): string {
  const value = serverEnv(key);
  if (!value) {
    throw new Error(
      `Missing required env var: ${key}. Set it in .dev.vars (local) or via ` +
        `\`wrangler secret put ${key}\` (production). See .dev.vars.example.`
    );
  }
  return value;
}
