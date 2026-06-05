# herocast-web — TanStack Start (SSR) on Cloudflare Workers

The framework migration of herocast from **Next.js 15 App Router** to **TanStack Start
(SSR) on Cloudflare Workers** — Track B of [#744](https://github.com/hero-org/herocast/issues/744),
tracked in [#754](https://github.com/hero-org/herocast/issues/754). This directory is
**Phase 1 (Foundation)**: the app shell, providers, auth wiring, fonts/images, and the
forkable deploy config. Pages (Phase 2) and API routes (Phase 3) land next.

## Why a separate `web/` directory?

The current app runs **React 18 / Next 15**; TanStack Start requires **React 19**. Two
React majors can't share one dependency tree, so the new app lives here with its **own
`package.json` + lockfile + `node_modules`** and coexists with the Next app during the
migration (strangler-fig). **Phase 4** promotes `web/` to the repo root and deletes Next.

Until then, `web/` deliberately **copies** the framework-agnostic pieces it needs
(`src/styles/globals.css` design tokens, the Satoshi `.woff2` faces, `tailwind.config.js`
theme) so it stays self-contained and forkable. Keep them in sync with the repo root
until cutover.

## Requirements

- **Node ≥ 22** (wrangler/workerd). `nvm use 22`.
- **pnpm** (v10 skips native build scripts — see install step).

## Run it (local workerd)

```bash
cd web
pnpm install
# pnpm v10 skips native postinstall — workerd/esbuild need them:
pnpm rebuild esbuild workerd

cp .dev.vars.example .dev.vars   # then fill in real values

# Fast dev (Vite + workerd via @cloudflare/vite-plugin):
pnpm dev

# Or build + run the production worker bundle on real workerd:
pnpm build
pnpm serve                       # wrangler dev -c dist/server/wrangler.json --port 8799

# Sanity checks:
curl localhost:8799/api/health   # { ok, secrets: {...} }  — verify secrets resolved
curl localhost:8799/             # SSR HTML app shell
```

## Secrets (forkability bar, #754)

Secrets are **never** committed and **never** put in `wrangler.jsonc`. There are **two
kinds**, with different lifecycles — don't mix them up:

### A. Server-runtime secrets — `.dev.vars` / `wrangler secret put`

| Var | Purpose | Legacy fallback |
|-----|---------|-----------------|
| `NEYNAR_API_KEY` | Farcaster API (Neynar), server-side | `NEXT_PUBLIC_NEYNAR_API_KEY` |
| `SUPABASE_URL` | Supabase project URL, server-side | `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Supabase anon key, server-side | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

- **Local dev:** copy `.dev.vars.example` → `.dev.vars` (gitignored). `vite dev` /
  `wrangler dev` load it automatically.
- **Production:** push each to the deployed Worker:
  ```bash
  wrangler secret put NEYNAR_API_KEY
  wrangler secret put SUPABASE_URL
  wrangler secret put SUPABASE_ANON_KEY
  ```
- Read on the edge via `import { env } from 'cloudflare:workers'` (`src/lib/env.ts`) —
  `process.env` is unreliable on workerd. The server Supabase helper (`getSupabaseUrl`/
  `getSupabaseAnonKey`) and `getNeynarApiKey` also accept the legacy `NEXT_PUBLIC_*`
  names, so an existing herocast `.env` can be reused unchanged.

### B. Client build-time vars — `.env.local` (NOT `.dev.vars`)

| Var | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | browser Supabase client (lands in Phase 2) |

Vite inlines `VITE_*` vars into the **client bundle at BUILD time** — it reads them from
`.env.local` (or the shell), **never from `.dev.vars`**.

- **Local dev:** copy `.env.local.example` → `.env.local` (gitignored).
- **Production:** pass them as build-time env (there is no `wrangler secret put` for
  these — the built bundle never reads worker runtime env):
  ```bash
  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... pnpm build && wrangler deploy -c dist/server/wrangler.json
  ```

Phase 1 doesn't call the browser client, so (B) is optional until Phase 2.

## Deploy (a fork stands up with this)

```bash
# Edit wrangler.jsonc -> set your own `name`.
pnpm build
wrangler deploy -c dist/server/wrangler.json
# (or `pnpm deploy:dry-run` to validate the deployable artifact without creds)
```

## What's in Phase 1

| Area | Status |
|------|--------|
| Scaffold (`@cloudflare/vite-plugin` + `tanstackStart()` + `viteReact()`, `nodejs_compat`, `server-entry`) | ✅ proven config from the Phase-0 spike |
| App shell + root document (`__root.tsx`, `routes/index.tsx`) | ✅ |
| Providers: TanStack Query + next-themes | ✅ |
| Auth: Supabase server client — `getRequest()` + getAll/setAll read; `setCookie` write; `/api/auth/callback` (chunked `sb-*.0/.1`) | ✅ |
| Fonts: `next/font` → self-hosted `@fontsource` (Inter, JetBrains Mono) + `@font-face` (Satoshi ×6), same `--font-sans/--font-display/--font-mono` vars | ✅ |
| `next/image` → `@/components/ui/image` (+ `next/link` → `@/components/ui/link`) primitives | ✅ primitives + 5/26-site inventory |
| Secrets template (`wrangler.jsonc` + `.dev.vars.example` + this README) | ✅ |

## Deferred (later phases — intentionally NOT in Phase 1)

- **IndexedDB Query persistence** (#735, `PersistQueryClientProvider`) — client-only,
  depends on store code → Phase 2.
- **PostHog / Sentry** — analytics client-only; Sentry rewires `@sentry/nextjs` →
  `@sentry/cloudflare` → later phase.
- **WalletProviders** (wagmi/rainbowkit/auth-kit), AuthProvider redirect, store init,
  CommandPalette/GlobalHotkeys — Phase 2/3.
- **Buffer polyfill + faker-stub alias** — only needed once `@farcaster/core`/store code
  is imported (Phase 2). Add `vite-plugin-node-polyfills` (`{ include: ['buffer'] }`) and
  a `@faker-js/faker` → faker-stub `resolve.alias` then.
- **25 pages / 31 API routes** — Phases 2–3.
