# Phase 0 spike — TanStack Start (SSR) on Cloudflare Workers

> **THROWAWAY feasibility spike for [hero-org/herocast#754](https://github.com/hero-org/herocast/issues/754). NOT production code, NOT the migration.**
> Its only job: answer 3 unknowns with running code on the `workerd` runtime. The
> findings are the product; this code is reference. Do not merge into `main`.

## Verdict: **GO** — all 3 unknowns resolved as **WORKS** on real workerd (`wrangler dev`).

| # | Unknown | Result | Evidence |
|---|---------|--------|----------|
| 1 | `@neynar/nodejs-sdk@1.21.1` (axios) under `nodejs_compat` | ✅ **WORKS** | SDK returned real trending casts on workerd. REST fallback also works but is **not needed**. |
| 2 | `unstable_cache` replacement | ✅ **WORKS** | Cloudflare Cache API (`caches.default`): request 1 = `MISS`, request 2 = `HIT` (same `fetchedAt`). |
| 3 | Supabase session cookie in a Start server fn | ✅ **WORKS** | `@supabase/ssr` `getAll/setAll` adapter reads the request cookie; `supabase.auth.getUser()` runs on workerd. |

### Phase 0.5 — the two unknowns the spike deliberately skipped (also ✅)

| # | Unknown | Result | Evidence |
|---|---------|--------|----------|
| 4 | `embeds/metadata` WASM (`@officialunofficial/trek`) — only HIGH risk | ✅ **WORKS** | `import .wasm` module + `initSync({ module })`; parsed sample + live github.com on workerd. |
| 5 | Auth **WRITE**/login cookie path (chunked `sb-*.0/.1`) | ✅ **WORKS** | TanStack `setCookie` emits chunked Set-Cookie; round-trip read reassembles via `combineChunks`. |

See [`FINDINGS.md`](./FINDINGS.md) (Q1–Q3) and [`PHASE-0.5.md`](./PHASE-0.5.md) (WASM + auth-write, incl. codex corrections) for verbatim output.

## What's here (the thinnest slice)

- `src/routes/index.tsx` — one SSR route. Its loader calls two `createServerFn`s and
  renders a server-loaded list of trending casts. **(server fn A + B, SSR)**
- `src/lib/trending.ts` — **Q1 + Q2**. Ports `app/api/feeds/trending/route.ts`: Neynar
  SDK call with an inline-REST fallback, wrapped in a Cache-API cache (`unstable_cache` sub).
- `src/lib/getUser.ts` — **Q3**. Reads the Supabase cookie from the raw request via the
  `@supabase/ssr` cookie adapter and calls `auth.getUser()`. Mirrors
  `src/common/helpers/supabase/route.ts` but framework-agnostic.
- `src/routes/api/probe.ts` — a server route returning all 3 answers as JSON (`/api/probe`).

Out of spike scope (known-hard, per #754): embeds/metadata WASM, `next/font`,
`next/image`, wallet/auth-kit.

## Run it (local workerd)

```bash
pnpm install
# pnpm v10 skips native build scripts — workerd/esbuild need them:
pnpm rebuild esbuild workerd
cp .dev.vars.example .dev.vars   # then fill in (NEYNAR_API_DOCS works for trending)
pnpm build                       # vite build -> dist/server + dist/client
npx wrangler dev -c dist/server/wrangler.json --port 8799   # real workerd

curl localhost:8799/api/probe        # JSON: all 3 answers
curl localhost:8799/api/probe        # again -> cache HIT
curl localhost:8799/                  # SSR HTML with the cast list
```

> Requires Node ≥ 22 (wrangler). Edge `wrangler deploy` needs Cloudflare creds (absent
> in this sandbox), but `wrangler deploy --dry-run` validates the deployable artifact.

## Versions proven

`@tanstack/react-start@1.168.20` · `@tanstack/react-router@1.170.11` · `react@19.2` ·
`@neynar/nodejs-sdk@1.21.1` (→ `axios@1.17.0`, `viem@1`) · `@supabase/ssr@0.8.0` ·
`@supabase/supabase-js@2.91` · `@cloudflare/vite-plugin@1.40` · `wrangler@4.98` ·
`vite@6.4` · `workerd@1.20260603`.
