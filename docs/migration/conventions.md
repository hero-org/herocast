# Migration conventions — the reuse contract

> **Read this before touching any migration unit.** Its job is to stop drift, duplication, and AI slop: every unit **reuses the named seams** instead of reinventing them. The Tier-2 codex integration review (see `strategy.md`) enforces this. All paths are under `src/web/` unless noted.

## Reuse these seams — do NOT reinvent them

| Need | Use this | Notes |
|------|----------|-------|
| Read a server secret/env | `serverEnv(key)` / `requireServerEnv(key)` — `src/web/lib/env.server.ts` | Reads `cloudflare:workers` env then `process.env`. **Read inside handlers, never at module scope** (undefined on workerd). |
| Cache a fetch (replaces `unstable_cache`) | `withCacheAPI(key, ttl, produce, shouldCache?)` + `CacheBackend` — `src/web/lib/trending.server.ts` | CF Cache API where available, else in-memory Map+TTL. **Never cache failed/empty results** (pass `shouldCache`). The 12 `unstable_cache` sites port here. |
| Call Neynar / Farcaster data | the **`FarcasterProvider` seam** — `src/lib/farcaster/providers/neynar.ts` | Pages call the provider, **not** API routes directly. Route ports go *behind* this seam. Neynar SDK v1 string ctor works on workerd. |
| Server-side data/logic from a route or loader | a `createServerFn` **thin wrapper** that delegates to a `*.server.ts` impl | See `getUser.ts`→`getUser.server.ts`, `trending.ts`→`trending.server.ts`. |
| Read the Supabase session | `getUserFn` — `src/web/lib/getUser.ts` (never throws; returns `{user,...}`) | Proven against real Supabase (returns a real UUID on workerd). |
| Write the Supabase session (login/callback) | the **302-redirect callback pattern** — `src/web/routes/api/auth/callback.ts` + `supabase/server.server.ts` write client | **`setCookie` only survives on a NON-2xx response.** A 200 JSON auth-write silently drops chunked `sb-*` cookies. |
| `next/navigation` (router/pathname/params/search) | the **navigation adapter** `@/web/lib/navigation` *(built in unit #2)* | Re-point all imports here; do NOT scatter TanStack router calls. Template: the dead `app/router-compat-full.ts`. |
| `next/link` / `next/image` | `@/web/components/link.tsx` / `image.tsx` | Already stubbed in Phase 1. `<Link>` uses `preload="intent"`. |
| `next/dynamic` (`ssr:false`) | TanStack lazy + `import.meta.env.DEV` guards | Editor/wallet are the main consumers. |
| `@faker-js/faker` | the Vite `resolve.alias` → `src/lib/faker-stub.ts` (in `vite.config.mts`) | Already wired; prevents a +7.9 MB regression when `@farcaster/core` lands. |
| Pick a host (CF vs Vercel) | the **`TARGET` flag** in `vite.config.mts` | `cloudflare` (default) vs `vercel` (gated on vite 7 — see `phase-1.md §0.1`). |

## The `.server.ts` boundary convention (load-bearing — R13)

A module reachable from the client route graph that imports server-only code (`cloudflare:workers`, Neynar SDK, node builtins) **breaks the client build** (`Rollup failed to resolve 'cloudflare:workers'`). The runtime `@tanstack/react-start/server-only` marker is **unreliable under `vite build`**. The deterministic fix:

- Put pure server logic in a **`*.server.ts`** file (matched by the default client deny-rule).
- A module that exports a server fn stays a **thin client-importable wrapper** delegating to a `*.server.ts` impl. Do **not** keep server-only code in exported non-fn helpers of a client-reachable module.
- The `cloudflare:workers` → empty-stub alias is scoped to `environments.client` (CF) / top-level (non-CF) in `vite.config.mts` — don't touch it.

## Load-bearing gotchas (from `phase-1.md §6`)

- **Vite plugin order** is fixed: host plugin → `tanstackStart()` → `viteReact()` → `tsconfigPaths()`. Don't reorder.
- **`setCookie` only on non-2xx** (auth writes) — see table above.
- **Cache API has no tag invalidation** — TTL (`max-age`) only.
- **Env inside handlers**, never module scope.
- **Single React tree** — verify no duplicate `react`/`react-dom` after any dep change.
- **Node ≥ 22** for the `web:*` scripts (wrangler/build). ⚠️ The repo `.nvmrc` pins **v20** for the Next app — in migration workspaces use node 22+ (`nvm use 22`). After install run **`pnpm rebuild esbuild workerd`** (pnpm v10 skips native build scripts).
- **`@types/node`** isn't in the TanStack tsconfig (`types: ["vite/client"]`) — read `process`/globals through a narrow cast, as the existing `.server.ts` files do.

## Do NOT

- ❌ Touch `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, or any live-app script. (Fonts live in `src/web/styles/fonts.css` — never append to `globals.css`.)
- ❌ Add the TanStack code outside `src/web/` (it's excluded from the Next tsconfig — that exclusion is what keeps the Vercel build un-breakable).
- ❌ Reinvent a seam in the table above. If you need a variant, extend the seam, don't fork it.
- ❌ Add a dependency without checking it doesn't force a vite/react major bump (would destabilize the proven CF path).
- ❌ Cache a failed/empty response.
- ❌ Leave `next/navigation` imports un-adapted in a ported file.

## cf-canary verification (every unit's "done")

`pnpm web:build` green (bundle < 3 MB gzip) → `pnpm web:serve` (node ≥22, `wrangler dev`) → exercise the ported surface at `cf.herocast.xyz` (or local `:port/<route>`). Confirm `pnpm web:typecheck` **and** the live app's `pnpm typecheck` both stay 0 (coexistence). Then update `strategy.md` status.
