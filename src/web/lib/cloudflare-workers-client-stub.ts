// CLIENT-BUILD STUB for the `cloudflare:workers` virtual module.
//
// `cloudflare:workers` is a Workers-runtime virtual module that the
// @cloudflare/vite-plugin only registers as a builtin in the worker (`ssr`)
// environment. The CLIENT Rollup build has no such builtin, so when the client
// import graph reaches a module that imports `cloudflare:workers` (the route tree
// statically pulls in the server route handlers → supabase/server.ts →
// src/web/lib/env.ts), the client build dies with
//   "Rollup failed to resolve import 'cloudflare:workers'".
//
// TanStack Start's `@tanstack/react-start/server-only` marker is the intended way to
// keep such a module out of the client, but in `vite build` (Rollup) mode the marker
// only DETECTS the cross-env import — it cannot pre-empt Rollup resolving the
// `cloudflare:workers` import inside the marked module, so the build still fails.
//
// The fix is an env-scoped alias (see vite.config.mts → environments.client) that
// points `cloudflare:workers` at THIS empty stub for the client build only. The
// worker (`ssr`) environment is unaffected — the cloudflare plugin's builtin still
// wins there, so server code reads the real runtime `env`. This stub is never
// EXECUTED in the client: every caller of `serverEnv()` runs server-side only
// (loaders / server fns / server route handlers), and those bodies are stripped from
// the client bundle by the Start compiler. The export shape mirrors the real module's
// `{ env }` named export so the client build's type/shape expectations hold.
export const env: Record<string, string | undefined> = {};
