// SERVER-ONLY. Do NOT import this into a client module — the `cloudflare:workers`
// import breaks the client build, and these helpers read runtime secrets that must
// never reach the browser. Client config comes from `import.meta.env.VITE_*` instead.
//
// Env model (plan D7): server secrets are runtime values (Worker env / .dev.vars),
// read INSIDE handlers — module-scope reads of `cloudflare:workers` env return
// undefined on workerd (plan R5). On Cloudflare we read the `cloudflare:workers` env
// first, then fall back to globalThis.process?.env (Node/dev/Vite SSR).
//
// The `.server.ts` filename is LOAD-BEARING: the `cloudflare:workers` virtual module
// only resolves in the Cloudflare worker (SSR) environment, but this module is
// transitively reachable from the client route graph (route tree → server route
// handlers / server fns → supabase + neynar → here). import-protection's DEFAULT
// client deny-rule (`**/*.server.*`) mocks this whole module out of the client bundle
// deterministically in Rollup `build` mode — unlike the runtime `server-only` marker,
// which races against Rollup resolving the `cloudflare:workers` import here. The
// client-build alias in vite.config.mts (cloudflare:workers → empty stub) is a
// belt-and-suspenders backstop for any client path that still references the specifier.
import { env as workerEnv } from 'cloudflare:workers';

/**
 * Read a server-side env var. Workers `env` first, then process.env fallback.
 * Returns undefined if absent (callers decide whether that is fatal).
 */
export function serverEnv(key: string): string | undefined {
  const fromWorker = workerEnv?.[key];
  if (fromWorker !== undefined && fromWorker !== '') return fromWorker;

  // process is not declared on globalThis without @types/node (this config only
  // loads vite/client types), so read it through a narrowly-typed accessor.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProcess = proc?.env?.[key];
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;

  return undefined;
}

/**
 * Read a required server-side env var, throwing a forkability-friendly message that
 * tells the operator exactly which value to provide and where.
 */
export function requireServerEnv(key: string): string {
  const value = serverEnv(key);
  if (value === undefined) {
    throw new Error(
      `Missing required server env var "${key}". Set it locally in .dev.vars ` +
        `(see .dev.vars.example) or in production via \`wrangler secret put ${key}\`.`
    );
  }
  return value;
}
