# Phase 1 — TanStack Start SSR Foundation (Preview-Only)

> **Epic #754 · Phase 1 of N** — In-place migration of herocast from Next.js 15 to TanStack Start (SSR) on Cloudflare Workers.
> **Status: IMPLEMENTED & verified on workerd (preview-only).** Prerequisite #759 (React 18 → 19) ✅ merged into `main` (`3bdbedbc`). This phase is **preview-only**: it adds a *separate* Cloudflare Workers deploy target. **The live Next.js app on Vercel is not touched** — no `next.config.mjs`, `vercel.json`, routing, or middleware changes. Zero user-facing impact.

**One-line goal:** Stand up the TanStack Start shell + one full vertical slice (`/migration-probe`) that SSR-renders the TRENDING feed through the Cloudflare Cache API and round-trips a Supabase auth cookie — on real `workerd`, deployable via `wrangler deploy` to a preview Worker — so every Phase-0 unknown is proven on `main`'s React 19 tree and later phases can port pages onto a known-good foundation.

## 0. Implementation status (verified)

Built in-place under `src/web/` and verified on real `workerd`: `pnpm web:build` ✅ (bundle **578 KiB gzip**, < 3 MB), `pnpm web:typecheck` ✅, **live app `pnpm typecheck` still 0 errors** ✅, `wrangler dev` boots → `/api/health` 200 (`hasProcess:true, hasCachesDefault:true`) ✅, `/migration-probe` SSR-renders 200 with no secrets and with a failing key (no 500) ✅, `web:deploy:dry-run` ✅.

**Live run against real Supabase (probe output):** the probe round-tripped a **real authenticated session** — `sessionCookieMatched:true`, `networkValidationAttempted:true`, `auth.user` = a real Supabase UUID. This proves the chunked `sb-*` cookie READ + `getUser()` network validation on workerd **with a valid session** — exceeding the spike, which only proved the no-session/401 path. Trending returned a Neynar **402 over-quota** on the dev key → graceful empty state via the SDK→REST→empty fallback (not a defect; a quota'd `NEYNAR_API_KEY` renders real casts). Still not run: a real `wrangler deploy` from CI, and the worker's OWN OAuth `exchangeCodeForSession` write (the user logged in via the live Next app; the worker only read that cookie).

**Deviations from this PRD draft (all to protect the live app or fix bugs found during build — they supersede the relevant sections below):**
1. **Scripts namespaced `web:*`** (`web:dev`/`web:build`/`web:serve`/`web:deploy`/`web:deploy:dry-run`/`web:typecheck`) — the bare `dev`/`build`/`start`/`serve`/`typecheck` belong to Next/Vercel and are untouched.
2. **All new source isolated under `src/web/`** with a separate `tsconfig.tanstack.json` (root `tsconfig.json` is Next's, incompatible `jsx`); root tsconfig gets an additive `exclude` so the live typecheck stays green. `vite.config.ts` is `vite.config.mts` (ESM, no `"type":"module"` in package.json).
3. **Fonts isolated in a new `src/web/styles/fonts.css`** (NOT appended to `src/globals.css`). `globals.css` is byte-identical → kills risk R9 / open-question #10. Supersedes D4 and §4.5.
4. **Probe serves at `/migration-probe`** (no leading underscore — a leading `_` is TanStack's *pathless* convention and would mount it at `/`). Supersedes §4.10 / §2.
5. **Server/client boundary enforced via the `.server.ts` filename convention** + thin server-fn wrapper modules (the runtime `@tanstack/react-start/server-only` marker is unreliable under `vite build`); `cloudflare:workers` aliased to an empty stub scoped to `environments.client`. New gotcha for Phase 2 — see §6 R13.

### 0.1 Host portability — the framework is NOT Cloudflare-locked

The framework migration and the hosting choice are **orthogonal axes**. TanStack Start emits a universal WHATWG `fetch(request)` server entry, so the host is a **build-plugin swap**, not a code change. Seams added so the same `src/web` code runs on either host:
- **`TARGET` build flag** (`vite.config.mts`, default `cloudflare`). The non-CF branch drops `cloudflare()` and top-level-aliases `cloudflare:workers` → the empty stub so `serverEnv()` falls through to `process.env`.
- **`CacheBackend` interface** (`trending.server.ts`): `CloudflareCacheBackend` (`caches.default`) + `MemoryCacheBackend` (Map+TTL for Node/Vercel), chosen by runtime capability. Also the seam the 12 `unstable_cache` sites port onto in Phase 3.

**Vercel is a supported target — UNBLOCKED on vite 7 (unit #1, ✅).** The wiring is `nitro({ config: { preset: 'vercel' } })` from `nitro/vite` (nitro v3), dropped into the non-CF host-plugin slot. It did NOT build on the repo's old vite 6 (verified by spike): nitro v3's Vercel Build-Output finalize runs in vite 7's `buildApp` **plugin** hook, which vite 6 never invoked — so the build exited 0 but emitted only static assets (no `functions/`/`config.json`) and was not deployable. **Unit #1's vite 6→7 bump fires that hook:** `TARGET=vercel vite build` (script `web:build:vercel`) now emits a deployable `.vercel/output/{config.json (Build Output API v3), functions/__server.func (streaming; function `runtime` = build-node major, so build on node ≥22 to ship `nodejs22.x` not EOL `nodejs20.x`), static/}` (+ `nitro.json`). The `nitro` devDep + `web:build:vercel` script are re-added and the slot in `vite.config.mts` is wired live.

**vite 7 bump — ✅ done (unit #1):** vite is consumed ONLY by this TanStack build (`next.config.mjs` has zero vite refs), so the bump could not affect the live Next/Vercel app. `@cloudflare/vite-plugin@1.40` accepts vite `^7`, `@tanstack/react-start@1.168` peer-wants vite `>=7` (the bump **fixed** that previously-tolerated mismatch); shipped `vite ^7.3.5` + `@vitejs/plugin-react ^5.2.0` (the latest 5.x line — 6.x requires vite `^8`). No build fallout in the isolated `src/web` build (web:build/web:typecheck/live typecheck all 0; CF probes 200). One benign vite-7 default shift: `build.target` `'modules'` → `'baseline-widely-available'` (Chrome/Edge 107+, FF 104+, Safari 16+) — accepted (modern targets, smaller output; no explicit `build.target` pinned).

---

## 1. Objective & Non-Goals

### Objective
Port the **spike-proven** TanStack Start foundation (config, SSR shell, auth seam, fonts, primitives) directly onto `main` at the repo root, and wire **one throwaway end-to-end route** that exercises the three things that were de-risked in Phase 0/0.5:

1. **SSR data fetch** via a `createServerFn` calling the Neynar SDK (`fetchTrendingFeed`).
2. **Edge cache** via `withCacheAPI` (Cloudflare Cache API, MISS → HIT).
3. **Auth read** via `@supabase/ssr` `getUser()` round-tripping the `sb-*` cookie.

The deliverable is a single PR that builds, type-checks, runs under `wrangler dev`, and `wrangler deploy`s to the existing preview Worker.

### Non-Goals (explicitly out of scope for Phase 1)
- **Porting real pages or API routes** (26 pages / 36 API routes, verified on `main`) — Phase 2/3.
- **Cutover** — making TanStack Start the default app / DNS / Vercel changes — Phase 4.
- **Sentry / error tracking** — deferred to Phase 3 (`@sentry/cloudflare`). Preview runs with `observability.enabled` only.
- **Data-layer work (#742)** — independent track; do not entangle.
- **Touching the live Next.js + Vercel app** in any way (`next.config.mjs`, `vercel.json`, `middleware`, routing).
- **Wallet / auth-kit / TipTap / Zustand / IndexedDB persister / PostHog / PersistQueryClientProvider** — all deferred (Phase 2/3).
- **trek WASM** in this PR — the loader pattern is *proven* and *documented* but **not wired into the probe** (not needed for trending; brings ~700 KB gzip). Carried as a known-good pattern for Phase 2 embeds.
- **CF account/project bootstrap** — account + Worker already exist (see §7).

---

## 2. Definition of Done / Acceptance Criteria

All of the following must be checkable in the single PR:

**Build & toolchain**
- [ ] `pnpm install && pnpm rebuild esbuild workerd` succeeds on Node ≥ 22.
- [ ] `pnpm run typecheck` (`tsc --noEmit`) is green (relies on ambient `cloudflare:workers` + `*.wasm` decls pre-`wrangler types`).
- [ ] `pnpm run build` (`vite build`) emits `dist/server/wrangler.json` and a worker bundle **under the 3 MB compressed limit** (spike: 616 KB gzip without WASM).
- [ ] `pnpm run serve` (`wrangler dev -c dist/server/wrangler.json`) boots the worker locally.
- [ ] `pnpm run deploy:dry-run` passes; **`pnpm run deploy` succeeds** to the preview Worker.

**Shell**
- [ ] SSR root renders `<html>` with `--font-sans/display/mono` resolved from the design tokens (now defined in the **reused root `src/globals.css`** rather than injected by `next/font`); no FOUC (single bundled stylesheet); no hydration warnings (`suppressHydrationWarning` on `<html>`).
- [ ] `ThemeProvider` (next-themes) + `QueryClientProvider` mount; light/dark toggle works.
- [ ] Fonts render via `@fontsource-variable` (Inter, JetBrains Mono) + self-hosted Satoshi `@font-face`, with both `Satoshi-Medium` (normal) **and** `Satoshi-MediumItalic` mapped to `font-weight: 600`.

**Vertical slice — `/migration-probe` (SSR route)**
- [ ] Route SSR-renders the **TRENDING feed** server-side: loader runs `getTrendingFn()` on `workerd`, Neynar SDK `fetchTrendingFeed()` returns casts (no REST fallback needed).
- [ ] **Cache proven**: first request → `cacheStatus: MISS`, second within TTL → `HIT` with identical payload (e.g. matching `fetchedAt`).
- [ ] **Auth read proven**: `getUserFn()` calls `getUser()`; with no/invalid cookie it returns `{ user: null }` without throwing; with a valid `sb-*` cookie the network-validation path is reached (probe surfaces `networkValidationAttempted`, `sessionCookieMatched`).
- [ ] Probe page renders without secrets present (graceful `null`), proving the shell is forkable.

**Coexistence guarantee**
- [x] `git diff` against `main` shows **zero changes** to `next.config.mjs`, `vercel.json`, `app/`, `pages/`, **`src/globals.css`** (byte-identical, md5-verified), or any live runtime path. The only edits to existing files are additive: `package.json` (deps/scripts/engines), root `tsconfig.json` (`exclude += src/web`), `.gitignore`, `pnpm-lock.yaml`. All app source is new files under `src/web/`. The Vercel build is unaffected (and `next build` ignores type errors anyway).

---

## 3. Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | **Layout** | **In-place at repo root** (drop the `web/` strangler-fig) | The `web/` subdir existed only to isolate a React-18-vs-19 conflict that **#759 already resolved** — `main` is React 19. A subdir forces a second `package.json`/lockfile/`node_modules` and verbatim *copies* of `globals.css`/`tailwind.config.js`/fonts that must be kept in sync. In-place reuses the single design source and one dependency tree. |
| D2 | **Coexistence** | **Separate `wrangler deploy` preview target**, not a path-prefix/rewrite into the live app | Phase 1 is preview-only with **zero user-facing impact**. A path-prefix or `next.config` rewrite would couple the two apps and risk the production Vercel build. A standalone Worker (`name: "herocast-web"`) is independently deployable and trivially discardable; cutover routing is a Phase 4 concern. |
| D3 | **`unstable_cache` / trending-cache replacement** | **Cloudflare Cache API** via `withCacheAPI(key, ttl, produce)` (proven), **not KV** | Spike Q2 proved Cache API gives MISS→HIT with TTL via `Cache-Control: max-age`, zero-config (`caches.default`). In the probe it backs trending; in prod, trending currently uses a per-request **in-memory `Map` (2-min TTL)** in `app/api/feeds/trending/route.ts` — Cache API is the durable cross-request equivalent. The dozen `unstable_cache` call sites (D-note below) port to the same helper later. **Trade-off accepted:** per-colo (not global) and **no tag invalidation** — fine for short-TTL feed data. KV stays the option for global, non-HTTP-shaped values later. |
| D4 | **Fonts** *(SUPERSEDED by §0.3 — implemented in a separate `src/web/styles/fonts.css`, NOT appended to globals.css)* | **`@fontsource-variable` `@import` (Inter, JetBrains Mono) + local `@font-face` (Satoshi)** in `src/web/styles/fonts.css` (linked only by the TanStack root), which **defines** `--font-sans/--font-display/--font-mono` on `:root` | Replaces `next/font/google` + `next/font/local` (wired in `app/layout.tsx`) with no build-time Next dependency. On `main` these three vars are injected by `next/font` and only *consumed* by `globals.css`/`tailwind.config.js`; the TanStack path has no `next/font`, so `globals.css` must now **declare** the vars to the same `font-family` values. The token *names* stay byte-identical so `tailwind.config.js` `fontFamily` tokens resolve unchanged. Both Satoshi `Medium → 600` and `MediumItalic → 600` mappings preserved to match the original next/font weights. **Constraint:** the appended block must be scoped/inert for the Next app (Next still defines the vars via `next/font`, taking precedence in its tree) so the Vercel build's typography is unaffected. |
| D5 | **Source of truth** | **Port FROM two reference branches; do not merge either** | `feat/tanstack-start-phase1` (`d26aaf44`, `web/`) supplies config/auth/fonts/primitives. `spike/tanstack-start-phase0` (`1211c049`, `spike-tanstack-start/`) supplies Neynar + `withCacheAPI` + `getUser` + probe (+ FINDINGS.md / PHASE-0.5.md). Both are throwaway; we lift the *verbatim-proven* code, re-point paths to root `@/*`, and pin exact spike versions. Trust the spike's findings — do **not** re-run the spike deploy as a prerequisite. |
| D6 | **Dep versions** | **Pin the spike-resolved exact versions**, not the `web/` branch's loose `^` ranges | The `web/` branch uses caret floors (`@cloudflare/vite-plugin ^1.0.0` etc.). Pin the versions actually proven on `workerd`: see §8. Plugin/runtime compat here is empirical, not semver-guaranteed. |
| D7 | **Env model** | **`cloudflare:workers` `env` (server) + `VITE_*` `import.meta.env` (client)**, replacing `NEXT_PUBLIC_*` | Server secrets are runtime (Worker env / `.dev.vars`), read **inside handlers**. Client config is build-time-inlined by Vite. Accept legacy `NEXT_PUBLIC_*` / canonical `SUPABASE_*` fallbacks so the seam is forkable and matches existing key names. |
| D8 | **Sentry** | **Deferred to Phase 3** | Preview-only; `observability.enabled: true` is sufficient. Avoids wiring `@sentry/cloudflare` against an SDK surface that will change as real routes land. |

---

## 4. Work Breakdown

Each piece notes **what**, **source branch**, **approach**, and the **load-bearing gotcha**. Snippets are skeletons, not full files.

### 4.1 — Build config: `vite.config.ts`
- **What:** Vite config wiring Cloudflare + TanStack Start + React + tsconfig paths *(vite 6 as built in Phase 1; bumped to vite 7 in unit #1 — see §0.1)*.
- **From:** `feat/tanstack-start-phase1` (has `tsconfigPaths`); spike confirms the inner three.
- **Approach:** plugins-only config; no `resolve` block yet (faker alias added in 4.6).
- **Gotcha (load-bearing):** **Plugin order is non-negotiable.**

```ts
plugins: [
  cloudflare({ viteEnvironment: { name: 'ssr' } }), // pins SSR env → workerd
  tanstackStart(),                                  // MUST precede viteReact()
  viteReact(),
  tsconfigPaths(),                                  // last
]
```

### 4.2 — Build config: `wrangler.jsonc`
- **What:** Worker config for the preview deploy.
- **From:** both branches (identical shape).
- **Approach:** framework server-entry; one compat flag; **no vars/secrets in the file**.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "herocast-web",
  "compatibility_date": "2026-06-04",
  "compatibility_flags": ["nodejs_compat"],         // proven necessary + sufficient (Neynar/axios, @supabase/ssr)
  "main": "@tanstack/react-start/server-entry",
  "observability": { "enabled": true }
}
```
- **Gotcha:** Vite emits the **deployable** config to `dist/server/wrangler.json`. **Always run/deploy with `-c dist/server/wrangler.json`**, never the source `.jsonc`. Keep `NEYNAR_API_KEY`/`SUPABASE_*` out of this file (local `.dev.vars`, prod `wrangler secret put`).

### 4.3 — SSR shell: `router.tsx` + `routes/__root.tsx` + `providers/Providers.tsx`
- **What:** `getRouter()` factory (fresh per request), root document, provider tree.
- **From:** `feat/tanstack-start-phase1`.
- **Approach:** `createRootRoute` with `head()` porting Next `metadata`/`viewport`; CSS linked via `?url`; providers = `ThemeProvider → QueryClientProvider`, QueryClient in `useState(() => getQueryClient())` (singleton in browser, fresh per request on server).

```tsx
<html lang="en" suppressHydrationWarning>   {/* required for next-themes */}
  <head><HeadContent /></head>
  <body className="font-sans no-scrollbar">
    <Providers>{children}</Providers>
    <Scripts />
  </body>
</html>
```
- **Gotchas:** (1) `import appCss from '@/globals.css?url'` (the CSS lives at `src/globals.css`, **not** `src/styles/`) linked in `head().links` → single bundled stylesheet, no FOUC. (2) `suppressHydrationWarning` on `<html>` or next-themes throws hydration warnings. (3) `routeTree.gen.ts` is generated + gitignored — don't commit it. (4) Devtools lazy-only under `import.meta.env.DEV`. **Deferred providers** (PersistQueryClient/IndexedDB, PostHog, Auth/Hotkeys/Wallet) are *not* wired here.

### 4.4 — Supabase auth seam (read + write): `lib/supabase/server.ts` + `routes/api/auth/callback.ts`
- **What:** Server clients using `@supabase/ssr`'s `getAll`/`setAll` cookie API fed from the raw `Request`; `getUserFromRequest` read helper; OAuth callback write route.
- **From:** `feat/tanstack-start-phase1` (server seam + callback); spike `getUser.ts` (storage-key derivation + network-reached inference).
- **Approach:** read client = no-op `setAll`; write client routes `setAll` through TanStack `setCookie({ ..., secure: true })` and lets `@supabase/ssr` handle `sb-<ref>-auth-token.0/.1` chunking. `getUserFromRequest` **never throws** (returns `{ user: null, error }` so the shell renders without secrets).

```ts
// READ path: feed parsed cookies in, no-op writes.
createServerClient(url, anon, {
  cookies: { getAll: () => parseCookieHeader(req.headers.get('cookie') ?? ''),
             setAll: () => {} },
});
```
- **Gotcha (load-bearing): Start's `setCookie` only survives on a NON-2xx response.** Internally Set-Cookie merges onto the handler Response only when `!response.ok`. The OAuth callback returns **302**, so chunked `sb-*` cookies survive. **Any future 200 `Response.json` auth-write path will silently drop the cookies** — for those, capture cookies in a custom `setAll` and append to the Response headers explicitly. **Secondary gotchas:** use `@supabase/ssr`'s own `parseCookieHeader` (single decode — a hand-rolled `decodeURIComponent` double-decodes and corrupts base64url `%`); storage key = `sb-<first-hostname-label>-auth-token`; harden the `next` redirect param (require a single leading `/`, reject `//`) and drop `X-Forwarded-Host`.

### 4.5 — Fonts (next/font replacement)
- **What:** Self-hosted fonts declared inside the **reused root `src/globals.css`** (no copy).
- **From:** `feat/tanstack-start-phase1` (mechanism).
- **Approach:** `@import '@fontsource-variable/inter'` + `@import '@fontsource-variable/jetbrains-mono'`; 6 Satoshi `@font-face` blocks pointing at the **existing** `src/assets/fonts/Satoshi-*.woff2` (already in the repo — do **not** duplicate into `public/`); and declarations for `--font-sans`/`--font-display`/`--font-mono` (since `next/font` no longer injects them in the TanStack tree). Vite's built-in `postcss-import` inlines `@import`s and rewrites the relative `woff2` URLs.
- **Gotcha:** **Keep the `--font-*` *values* aligned** with what `next/font` produced so `tailwind.config.js` tokens resolve byte-for-byte. **Both `Satoshi-Medium.woff2` and `Satoshi-MediumItalic.woff2` map to `font-weight: 600`** (not 500) — matches the current `app/layout.tsx` mapping; getting this wrong shifts the display lockup weight. Because `globals.css` is shared with the live Next app, the appended block must not override the vars `next/font` already sets in the Next tree (Next's `<html>` class scoping wins there); verify the Vercel build's typography is byte-identical after the change.

### 4.6 — next/image + next/link primitives
- **What:** Drop-in shims for the two Next primitives.
- **From:** `feat/tanstack-start-phase1`.
- **Approach:** `components/ui/image.tsx` = thin `<img>` (`loading="lazy"`, `decoding="async"`, `alt=''` default). `components/ui/link.tsx` = external/absolute (`https?://`, `//`, `mailto:`, `tel:`, `#`) → `<a>`; internal → TanStack `<RouterLink to={href} preload={prefetch===false ? false : 'intent'}>`.
- **Gotcha:** **No consumers in Phase 1** (no real pages). Carry the migration inventory in code comments: `next/image` has **5 importer sites**, `next/link` has **26 importer sites** (verified on `main`). Dynamic typed routes get rewritten to native `<Link to params>` in Phase 2. Local image assets must be copied into `public/` when those sites port.

### 4.7 — faker-stub Vite alias
- **What:** `@faker-js/faker` → `src/lib/faker-stub.ts` alias (the Next webpack alias equivalent; the webpack version lives at `next.config.mjs:63`).
- **From:** *not present in either branch* — **author here** (DoD requires it).
- **Approach:** add a single `resolve.alias` entry mapping `@faker-js/faker` to the existing `src/lib/faker-stub.ts`. This is the Vite analogue of the `next.config.mjs` webpack alias.
- **Gotcha:** The probe doesn't import `@farcaster/core`, so the stub is **dormant in Phase 1** — but wiring it now prevents the +7.9 MB bundle regression the instant store/`@farcaster/core` code lands in Phase 2. **Do not** also add `vite-plugin-node-polyfills` (buffer) yet — defer with the faker note until `@farcaster/core` is actually imported.

### 4.8 — Vertical slice: trending server fn + `withCacheAPI`
- **What:** `lib/trending.ts` — Neynar SDK fetch (Path A) + REST fallback (Path B) + `withCacheAPI` + `getTrendingCached`.
- **From:** `spike/tanstack-start-phase0` (verbatim).
- **Approach:** v1 string constructor `new NeynarAPIClient(apiKey)` (exactly as herocast does it in `app/api/feeds/trending/route.ts`); SDK-first with REST fallback recorded; cache key = synthetic `Request('https://…internal/<key>')`, TTL carried purely on `Cache-Control: max-age`.

```ts
const cache = (globalThis as any).caches?.default as Cache | undefined;
const cacheKey = new Request(`https://herocast-cache.internal/${encodeURIComponent(key)}`);
// match → HIT; else produce(), put with `cache-control: public, max-age=${ttl}` → MISS; no cache → BYPASS
```
- **Gotcha:** **No tag invalidation — TTL only** (D3). Cache is **per-colo**. `getTrendingCached` uses `trending:<limit>`, TTL **120s** (mirrors prod's 2-min `CACHE_TTL` in the trending route). Neynar SDK works under `nodejs_compat` because `process` exists so axios picks its `node:http` adapter — REST fallback proven but **unused**.

### 4.9 — Vertical slice: `getUser` server fn
- **What:** `lib/getUser.ts` — `getUserFromRequest(request, url, anon)` wrapping `createServerClient` + `auth.getUser()`.
- **From:** `spike/tanstack-start-phase0` (verbatim core).
- **Approach:** parse cookies once with `parseCookieHeader`; `getAll` returns them; `setAll` no-op (read path); infer `networkValidationAttempted` from the **error class** (`AuthRetryableFetchError`/`AuthApiError` ⇒ reached network; `AuthSessionMissingError` ⇒ not).
- **Gotcha:** read env **inside** the handler — module-scope reads of `cloudflare:workers` `env` are `undefined` on Workers. Wire as a server fn with `getRequest()` (not the removed `getWebRequest`, per `@tanstack/react-start ≥ 1.168`).

```ts
const getUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  return getUserFromRequest(request, serverEnv('SUPABASE_URL'), serverEnv('SUPABASE_ANON_KEY'));
});
```

### 4.10 — Vertical slice: `routes/migration-probe.tsx`
- **What:** The throwaway SSR route tying it together.
- **From:** spike `routes/index.tsx` pattern, served at the `/migration-probe` path (NO leading underscore — a leading `_` is TanStack's *pathless/layout* convention and would mount the route at `/`).
- **Approach:** loader runs both server fns in parallel during SSR; page renders trending casts + a small evidence panel (`cacheStatus`, `sessionCookieMatched`, `networkValidationAttempted`, `user`).

```ts
loader: async () => {
  const [trending, auth] = await Promise.all([getTrendingFn(), getUserFn()]);
  return { trending, auth };
}
```
- **Gotcha:** explicitly **throwaway** — name it `migration-probe` so it reads as internal and is deleted before/at cutover (do NOT prefix `_` — that makes it pathless). It must render gracefully with no secrets (proves forkability) and must SSR (loader, not just client-fetch) so the `workerd` path is actually exercised.

### 4.11 — Supporting files
- `tsconfig.json` (new, for the TanStack/Vite build): `target ES2022`, `moduleResolution Bundler`, `jsx react-jsx`, `strict`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `types: ["vite/client"]`. `@/*` → `./src/*` (this **already matches** `main`'s root tsconfig — keep it, do not reintroduce the `web/`-relative `./src/*`).
- `env.d.ts`: ambient `declare module 'cloudflare:workers' { export const env: Record<string, string | undefined> }` (keeps `tsc` green pre-`wrangler types`) + `ImportMetaEnv` for `VITE_SUPABASE_*`.
- `lib/env.ts`: `serverEnv(key)` reads `cloudflare:workers` `env` first, falls back to `globalThis.process?.env` (server-only — importing into a client module breaks the client build); `requireServerEnv` throws a forkability message.
- `postcss.config.js`, `lib/utils.ts` (`cn`), `.npmrc` (`shamefully-hoist=true`, `strict-peer-dependencies=false`, `auto-install-peers=true`).
- `.gitignore`: add `src/routeTree.gen.ts`, `worker-configuration.d.ts`, `.dev.vars`.

---

## 5. Sequence (single-PR commit order + incremental validation)

Land as one PR, but commit in this dependency order; validate at each gate.

1. **Toolchain + config.** Add deps (pinned, §8), `.npmrc`, `tsconfig.json` (`@/*` → `./src/*`), `vite.config.ts`, `wrangler.jsonc`, `env.d.ts`, `lib/env.ts`.
   **Validate:** `pnpm install && pnpm rebuild esbuild workerd`; `pnpm run typecheck` green.
2. **Fonts in a NEW `src/web/styles/fonts.css`** (NOT `src/globals.css` — see §0.3). Add `@fontsource-variable` deps + `@import`s + 6 Satoshi `@font-face` blocks (pointing at the existing `src/assets/fonts/`) + `:root` `--font-*` var declarations. The TanStack root links this file alongside the shared `@/globals.css?url`.
   **Validate:** `tailwind.config.js` tokens still reference unchanged `--font-*` names; `src/globals.css` is untouched (byte-identical) so the live app needs no re-verification.
3. **SSR shell.** `router.tsx`, `routes/__root.tsx`, `providers/Providers.tsx`, `lib/queryClient.ts`, `components/ui/ThemeToggle.tsx`.
   **Validate:** `pnpm run dev` (Vite) renders the shell; theme toggle works; no hydration warnings.
4. **Primitives + faker alias.** `components/ui/image.tsx`, `components/ui/link.tsx`, `resolve.alias` for faker.
   **Validate:** `pnpm run typecheck` still green.
5. **Auth seam.** `lib/supabase/server.ts`, `lib/supabase/client.ts` (dormant), `lib/getUser.ts`, `routes/api/auth/callback.ts`, `routes/api/health.ts` (secret-presence + `hasProcess`/`hasCachesDefault` self-check).
   **Validate:** `pnpm run build` then `wrangler dev -c dist/server/wrangler.json` → `/api/health` returns runtime booleans.
6. **Vertical slice.** `lib/trending.ts`, `lib/neynar.ts` (`getNeynarApiKey`), `routes/migration-probe.tsx`.
   **Validate ladder:**
   - **Vite dev** (`pnpm run dev`) — shell + probe render (cache helper falls to `BYPASS` if no `caches.default`).
   - **`wrangler dev`** (built bundle) — real `workerd`: probe SSR-renders trending, **MISS then HIT** on refresh, `getUser` round-trips a test cookie (use the spike's `make-test-cookie.mjs` approach for chunked `sb-*`).
   - **`pnpm run deploy:dry-run`** — bundle under 3 MB.
   - **`pnpm web:deploy`** — preview Worker live; hit `/migration-probe` against real Neynar + Supabase.
7. **Coexistence check.** Confirm `git diff main` touches nothing in `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`; the only existing-file edits are additive (`package.json`, root `tsconfig.json` exclude, `.gitignore`, lockfile). ✅ verified.

---

## 6. Risks & Gotchas

| # | Risk / Gotcha | Impact | Mitigation |
|---|---------------|--------|------------|
| R1 | **Vite plugin order** | Wrong order silently breaks SSR/JSX | Enforce `cloudflare → tanstackStart → viteReact → tsconfigPaths`. Add a code comment; treat any reorder as a bug. |
| R2 | **`setCookie` only on non-2xx** | Auth-write cookies silently dropped on 200 JSON | OAuth callback returns **302** (proven). Document the constraint in the writable client docblock; any 200 auth-write path must append Set-Cookie to Response headers manually. |
| R3 | **pnpm v10 skips native build scripts** | `esbuild`/`workerd` binaries missing → build fails | **`pnpm rebuild esbuild workerd`** after install; add to setup docs and CI prebuild. |
| R4 | **Node < 22** | Toolchain breaks (engine = `>=22`) | Pin `engines.node >=22`; document; set CI Node 22. |
| R5 | **Env at module scope on Workers** | `env.X` reads `undefined` if read at import time | Read via `import { env } from 'cloudflare:workers'` **inside handlers**, with `process.env` fallback (`serverEnv` helper). |
| R6 | **Cache API: no tag invalidation** | Can't purge by tag; per-colo only | Accept for short-TTL feed (120s). For anything needing global/invalidatable cache later, use KV. Documented in D3 + §4.8. |
| R7 | **Neynar-on-axios is empirical** | Works because `nodejs_compat` exposes `process` → axios node adapter; could regress on SDK/compat-date change | REST fallback (Path B) retained as a native-`fetch` escape hatch; pin `@neynar/nodejs-sdk@1.21.1` + `compatibility_date 2026-06-04`; the probe is the canary on every deploy. |
| R8 | **Two React trees → now one** | Duplicate React (root + new TanStack deps) could cause invalid-hook / context errors | In-place layout uses **one** dependency tree on `main`'s React 19. After install, verify a single `react`/`react-dom` resolution (no duplicate in `pnpm-lock.yaml`); the `^19` floors and pinned TanStack must dedupe to one copy. |
| R9 | ~~**Shared `globals.css` font edit leaks into Next**~~ **RESOLVED** | — | Eliminated by §0.3: fonts live in a separate `src/web/styles/fonts.css` linked only by the TanStack root. `src/globals.css` is byte-identical (md5-verified), so there is no shared-file risk and no Next-build re-verification needed. |
| R10 | **`getWebRequest` removed** | Old spike/docs reference breaks on ≥1.168 | Use `getRequest()` from `@tanstack/react-start/server`. |
| R11 | **Source `.jsonc` vs built config** | Deploying source config fails / wrong shape | Always `-c dist/server/wrangler.json` (scripts already do this). |
| R12 | **Generated files committed** | `routeTree.gen.ts` / `worker-configuration.d.ts` churn | Gitignore both; generated at build / `wrangler types`. |
| R13 | **Server code leaks into the client bundle** (found during integration) | `Rollup failed to resolve 'cloudflare:workers'` / import-protection denial — the route tree statically imports server routes, dragging server-only modules into the client build | Use the **`.server.ts` filename convention** (client deny-rule) for pure server modules; keep server-fn modules (`getUser.ts`, `trending.ts`) as **thin client-importable wrappers** that delegate to a `.server.ts` impl (a server-fn module that also exports non-fn helpers keeps the denied import alive). The runtime `@tanstack/react-start/server-only` marker is **unreliable under `vite build`**. Backstop: alias `cloudflare:workers`→empty stub scoped to `environments.client` ONLY (a global alias breaks the worker env's `virtual:cloudflare/export-types`). This is the **canonical boundary pattern for Phase 2/3.** |

---

## 7. Secrets & Deploy

CF account + Worker (`herocast-web`) **already exist** — no bootstrap. Two env surfaces:

**Server-runtime secrets** (Worker env; never `import.meta.env`):
```bash
wrangler secret put NEYNAR_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

**`.dev.vars` (local Worker runtime — gitignored; template `.dev.vars.example`):**
```
NEYNAR_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

**`.env.local` (client build-time, Vite-inlined — gitignored; template `.env.local.example`):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
> Server seam accepts legacy `NEXT_PUBLIC_*` / canonical names as fallback. `VITE_*` are inlined at **build** time (pass them at build for prod) — they are *not* `wrangler secret put`. The browser client (`lib/supabase/client.ts`) is **dormant** in Phase 1.

**Deploy:** `pnpm run deploy` → `vite build && wrangler deploy -c dist/server/wrangler.json`. Dry run: `pnpm run deploy:dry-run`. Local worker: `pnpm run serve`.

---

## 8. Pinned Versions

Pin the **spike-proven** exact versions (override the `web/` branch's loose `^`):

| Package | Pin |
|---|---|
| `@tanstack/react-start` | `1.168.x` |
| `@tanstack/react-router` | `1.170.x` |
| `@tanstack/react-query` | `5.90.x` |
| `@cloudflare/vite-plugin` | `1.40.0` |
| `wrangler` | `4.98.0` |
| `vite` | `7.3.x` *(bumped 6→7 in unit #1; was `6.4.x` in Phase 1)* |
| (`workerd` resolved) | `1.20260603.x` |
| `@supabase/ssr` | `0.8.0` (matches `main`) |
| `@supabase/supabase-js` | `2.91.x` (matches `main`'s `^2.91.1`) |
| `@neynar/nodejs-sdk` | `1.21.1` (exact, matches `main`) |
| `@fontsource-variable/inter` | `5.1.x` |
| `@fontsource-variable/jetbrains-mono` | `5.1.x` |
| `@vitejs/plugin-react` | `5.2.x` *(bumped with vite 7 in unit #1; was `4.3.x` — 6.x needs vite `^8`)* |
| `vite-tsconfig-paths` | `5.1.x` |
| `react` / `react-dom` | `^19.0.0` (from `main`) |
| `@types/node` | `^20.17.x` *(stays node 20 — shared with the live Next app; NOT 22.x. The TanStack tsconfig uses `types: ["vite/client"]`, not `@types/node`. See `phase-2-vite7.md` accepted nits.)* |

`compatibility_date: "2026-06-04"`, `compatibility_flags: ["nodejs_compat"]`.

---

## 9. What This Unblocks (Phase 2/3 Preview)

The slice proves the substitutes that the rest of the migration leans on, so later phases port behind a thin server-fn seam rather than re-deriving them:

- **Neynar drop-in** — the v1 string-constructor SDK works as-is on `workerd`; the ~36 API routes (13 on the Neynar SDK) can become server fns one-for-one (REST fallback as escape hatch).
- **`withCacheAPI`** — replaces the in-memory trending cache *and* the **12 `unstable_cache` call sites** (verified on `main`) with a TTL-only Cache API helper; keep every cached fetch behind a server fn so swapping Cache API ↔ KV later is local.
- **trek WASM (+ fix #758)** — the Workers-module-import + `initSync({module})` pattern is proven for Phase 2 embeds; bake in the serde-flatten fix (read top-level `result.title/description/image`, not `result.metadata.*`) so prod embed metadata stops silently nulling.
- **Server-only `NEYNAR_API_KEY` (#751)** — the env seam keeps the key server-side (worker env), unblocking the key-exposure fix.
- **Auth seam** — read path proven; the `getAll`/`setAll` adapter and the non-2xx `setCookie` constraint are now documented for the full login flow.

Keep all data access behind `createServerFn` so Phase 2 page ports inherit a known-good, cache-aware, auth-aware boundary.

---

## 10. Open Questions / Explicitly Deferred

- ~~**Tauri desktop consumer** — the desktop build currently targets the Next app; how it consumes the TanStack app must be resolved **before Phase 4 cutover** (not Phase 1/2).~~ **DECIDED (deferred past #13):** wrap the same TanStack Start app in the **Deno desktop runtime** (auto-detects TanStack Start; reuses the host-portability seam — seam fall-through spike-verified; built+launched+rendered on macOS). Tauri removed from the repo. Backend pinned to `cef` (rendering fidelity; binary size deprioritized). Execution = 3 proof-driven issues (D1 #772 runs → D2 #773 secrets-safe data/auth + key custody → D3 #774 signing/deep-links/auto-update). Canary/experimental today. Full plan + the local-vs-remote-server (secrets) decision live in `desktop-deno-runtime.md`. Lands after cutover.
- **#758 (trek serde-flatten bug)** — independently shippable to *prod Next* now (read top-level `result.*`); fold the fix into the WASM port in Phase 2 regardless. *Deferred to P2, can pre-fix.*
- **#751 (server-only `NEYNAR_API_KEY`)** — env seam enables it; actual lockdown lands when API routes port. *Deferred to P2.*
- **Auth read path — PROVEN with a real session** (live probe run): chunked `sb-*` cookie read + `getUser()` returns a real Supabase UUID on workerd. What remains unproven: the worker's OWN OAuth `exchangeCodeForSession` *write* end-to-end (login THROUGH the worker) + stale-chunk deletion (`maxAge:0`). *Validate early in P2.*
- **React 19 interactive QA** — wallet (wagmi/rainbowkit/auth-kit) and TipTap editor under React 19 + SSR not exercised here (no interactive components in the probe). *Deferred to P2 when those providers port.*
- **`getUser` on every SSR request** — fine for the probe; for real pages, decide caching/session strategy to avoid a Supabase `auth/v1/user` round-trip per navigation. *Deferred to P2.*
- ~~**Shared `src/globals.css` ownership**~~ **RESOLVED** — fonts were isolated into `src/web/styles/fonts.css` (§0.3); `globals.css` is shared read-only (tokens) and never edited. No font-mechanism coexistence in one file. *Closed.*
