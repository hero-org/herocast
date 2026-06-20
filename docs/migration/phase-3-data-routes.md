# Unit #10 — data API routes behind the FarcasterProvider seam

> Part of epic #754, Track B. Ports the **19 provider-backed `/api/*` data routes** onto workerd as TanStack Start server routes. Blocked-by #0, #4 (both ✅). Sibling of #11 (auth/onchain/proxy/WASM routes) and #12 (dms/spaces/miniapp). Built via a dynamic codex workflow (`port → adversarial parity verify`).

## Objective

The shared `FarcasterProvider` seam (`src/lib/farcaster/providers/neynar.ts`) — which every feed/profile/user/channel RQ hook already calls — fetches the app's own `/api/*` HTTP endpoints (`buildUrl('/api/feeds/following', …)`). On Cloudflare those endpoints must exist as worker routes. This unit recreates each one as `src/web/routes/api/<path>.ts` (the `createFileRoute('/api/<path>')({ server: { handlers } })` pattern, mirroring `health.ts`), returning the **byte-identical JSON shape** the provider parses. **Zero hook/provider rewiring** — the `/api/*` paths are unchanged.

This is the **HTTP-route** model (model B), NOT `createServerFn` RPC. The `trending.ts` server-fn from Phase 1 is a probe-only spike artifact and is **not** the production path for client-consumed data.

## Non-goals

- Auth/onchain/proxy/WASM routes (`onchain/*`, `auth/*`, `oauth/decision`, `embeds/metadata`, `signerRequest`, `hypersnap`) — those are **#11**.
- Standalone surfaces (`dms/*`, `spaces/*`, `miniapp/manifest`) — those are **#12**.
- Touching the provider, the hooks, the live Next `app/api/*` routes, or `next.config.mjs`/`vercel.json`.
- Wiring Supabase secrets locally (the one supabase-touching read degrades to its empty/error state without `SUPABASE_*` in `.dev.vars`; Neynar routes are the substance).

## The 19 routes (machine-derived from provider `buildUrl`/`fetchJson` calls)

`casts`, `casts/conversation`, `casts/lookup`, `casts/reactions`, `channels`, `channels/search`, `channels/trending`, `feeds/channel`, `feeds/following`, `feeds/profile`, `feeds/trending`, `lists`, `notifications`, `search`, `users`, `users/active`, `users/best-friends`, `users/channels`, `users/search`.

## Files

**In (new):** `src/web/routes/api/<the 19 above>.ts`; `src/web/lib/cache.server.ts` (the shared edge-cache seam, extracted from `trending.server.ts`); `src/web/lib/node-tty-stub.ts`.
**Changed:** `src/web/lib/trending.server.ts` (imports `withCacheAPI`/`Cached` from the new `cache.server.ts`; re-exports `Cached`); `vite.config.mts` (the `nodeTtyStubPlugin`).
**Untouched:** the provider, all RQ hooks, every `app/api/*` route.

## Reuse contract (per `conventions.md`)

- **Cache (replaces `unstable_cache` and the routes' in-memory `Map`+TTL):** `withCacheAPI(key, ttl, produce, shouldCache)` from `@/web/lib/cache.server`. Never cache failed/empty results. Strip the seam's additive `cacheStatus` field before `Response.json` so the wire shape matches the source exactly.
- **Neynar:** `getNeynarApiKey()` (`@/web/lib/neynar.server`) read **inside** the handler; the v1 string ctor `new NeynarAPIClient(apiKey)` works on workerd under `nodejs_compat`.
- **Next → Web:** `NextRequest`→ the Web `request`; `req.nextUrl.searchParams`→`new URL(request.url).searchParams`; `NextResponse.json(x,{status})`→`Response.json(x,{status})`; drop `export const maxDuration`.
- Secrets read only via `serverEnv`/`getNeynarApiKey` inside handlers; never module scope; never echoed.

## Definition of Done / cf-canary (status as implemented)

- [x] `pnpm web:typecheck` 0, `pnpm web:build` 0, live `pnpm typecheck` 0, `pnpm test` 150/150.
- [x] All 19 routes ported (one self-contained new file each; conflict-free fan-out — no shared-file edits beyond the pre-extracted cache seam + the vite stub).
- [x] **Worker initializes on real workerd** (`pnpm web:serve`) — `/api/health` 200 with `NEYNAR_API_KEY:true`. (Blocked first by `node:tty`; see Gotchas.)
- [x] **Neynar SDK makes real HTTPS calls from workerd** — every route reaches `api.neynar.com` and returns a well-formed JSON envelope; params + error passthrough behave per source. (Re-confirms Phase-0 unknown #1 on hardware.)
- [x] Adversarial parity verify (per route, independent reviewer): 17/19 clean; 2 flagged + resolved — `channels` was leaking the `cacheStatus` field (now stripped); `search` omits 5 query params that are **dead in the source** (read but never used → no behavioral diff; left as-is, noted below).
- [ ] **200-with-data parity vs the live Next route — BLOCKED on Neynar quota.** The validation key was over its monthly CU allocation (HTTP 402), so every upstream call returns the quota error (correctly propagated). Re-run the smoke (`web:serve` + diff vs the live route) with a quota'd key, or verify post-`web:deploy`.

## Gotchas (this unit)

- **`node:tty` crashes worker init for ANY Neynar-importing route (load-bearing for #11/#12).** The Neynar SDK pulls `axios → follow-redirects → debug → supports-color`, which imports `node:tty` and calls `tty.isatty` at module load. workerd has no `node:tty` builtin, so the route tree's **eager** import of these handlers fails worker initialization and **every** route 500s (`No such module "node:tty"`). `trending.server.ts` dodged it only because no eagerly-loaded route imported the SDK (the probe used a lazy server-fn chunk). Fix: `nodeTtyStubPlugin` in `vite.config.mts` aliases `node:tty`/`tty` to a benign stub (`isatty: () => false`) in the `ssr`/workerd env — same plugin shape + rationale as `ssrClientOnlyStubPlugin` (env-level ssr aliases are dropped on merge by the cloudflare plugin).
- **Do NOT `import axios` directly in a route.** `feeds/profile` initially did (the source uses it for two no-SDK-helper feeds); the direct import pulled the `node:tty` path into the worker before the stub existed. Ported to native `fetch`, re-throwing an axios-shaped `{ response: { status, data } }` so the error branch keeps parity. The SDK's *internal* axios is fine (handled by the stub).
- **Strip `cacheStatus`.** `withCacheAPI` returns `Cached<T>` (adds `cacheStatus: 'HIT'|'MISS'`). Routes that wrap a response in it must destructure it out before responding or the wire shape drifts from the source.
- **Route-tree typecheck is generated.** New routes fail `web:typecheck` (`'/api/x' not assignable to keyof FileRoutesByPath`) until `vite build` regenerates `routeTree.gen.ts`. Build once, then typecheck.

## Follow-ups surfaced (not fixed here)

- **[#10 nit] `search` route** omits the 5 source params (`mode`, `sortType`, `authorFid`, `mentionFid`, `interval`) — they are dead in the source (never forwarded to Neynar). Add them if the source ever wires them.
- **[CI] gzip budget + the stub lists.** `ssrClientOnlyModules` and now `node:tty` are hand-maintained build-stub seams that fail only at the deploy/runtime gate. A CI assertion (gzip budget + a `web:serve` `/api/health` 200 smoke) in the #0 prebuild would catch regressions pre-merge.
- **[deploy] Live data parity** needs a quota'd Neynar key (the only DoD item not green here).
- **[#12] `lists` is the one supabase-touching route** of the 19; verify it once `SUPABASE_*` worker secrets are set.
