# Unit #2 — navigation seam: `next/navigation` → TanStack adapter

> Track B / epic #754. **The critical-path gate** — no surface ports until this lands. Spec template: `phase-1.md`. Reuse contract + agent protocol: `conventions.md`.

## Objective

Make shared components and ported routes use TanStack Router's navigation **without editing the 54 live-app call sites**, by providing a drop-in `next/navigation` adapter and aliasing it in the TanStack build only. The live Next app keeps using real `next/navigation` (untouched).

## Approach — adapter + build alias (NOT 54 re-points)

The migration is **in-place, no duplication**: the same `src/` components are consumed by both the Next build and the TanStack build. So instead of rewriting imports in 54 files (which would touch the live app), we:

1. Build `@/web/lib/navigation` — a drop-in implementation of the `next/navigation` API surface, backed by TanStack Router.
2. **Alias `next/navigation` → `@/web/lib/navigation` in the TanStack vite build only** (`vite.config.mts`). A shared component's `import { useRouter } from 'next/navigation'` then resolves to real Next in `next build` and to our adapter in `vite build` — zero edits to shared files.
3. New `src/web` code imports `@/web/lib/navigation` directly.

Same pattern for `next/link` → `@/web/components/link`, `next/image` → `@/web/components/image`, `next/dynamic` → a lazy shim.

## Adapter contract (the only APIs actually used — verified via grep)

`@/web/lib/navigation` MUST export, Next-compatible:

| Export | Next behavior | TanStack backing |
|--------|---------------|------------------|
| `useRouter()` | `{ push, replace, back, forward, refresh, prefetch }` | `useRouter()` → `push(href)`=`navigate({to:href})`, `replace`=`navigate({to,replace:true})`, `back/forward`=`history.go(±1)`, `refresh`=`router.invalidate()`, `prefetch`=`router.preloadRoute({to})` |
| `usePathname()` | `string` | `useLocation().pathname` (or `useRouterState({select: s => s.location.pathname})`) |
| `useSearchParams()` | `ReadonlyURLSearchParams` | `new URLSearchParams(useLocation().searchStr)` — exposes `.get/.getAll/.has/.entries/.toString` |
| `useParams()` | `Record<string,string \| string[]>` | `useParams({ strict: false })` |
| `redirect(url)` | navigate/throw | client: `router.navigate({to})`; bridge note in code |

`notFound`, `permanentRedirect`, `useSelectedLayoutSegment(s)`, `ReadonlyURLSearchParams` (type) are **unused** — don't implement (add a throwing stub only if a later unit needs one). Starting template: the dead `app/router-compat-full.ts` (343 LOC) — adapt, don't import it.

## Non-goals
- Editing any of the 54 live-app `next/navigation` files (the alias handles them).
- Porting any surface/page behavior (that's #5+).
- `next/headers`, `next/cache` (other units).

## Parallel areas (disjoint files — see `conventions.md` → Agent execution protocol)

- **Area A — adapter module.** `src/web/lib/navigation/actions.ts` (useRouter, redirect), `src/web/lib/navigation/location.ts` (usePathname, useSearchParams, useParams), `src/web/lib/navigation/index.ts` (barrel re-exporting all 5). Owns the whole adapter. Exports must match the contract names exactly.
- **Area B — build wiring.** `vite.config.mts` ONLY: add `resolve.alias` entries `next/navigation` → `@/web/lib/navigation`, `next/link` → `@/web/components/link`, `next/image` → `@/web/components/image`, `next/dynamic` → `@/web/lib/dynamic` (Area C's shim). Plus any `env.d.ts` ambient types needed. (References paths from A & C — parallel-safe.)
- **Area C — primitives parity + dynamic shim + probe.** Extend `src/web/components/link.tsx` & `image.tsx` to cover the full prop surface the 26 `next/link` + 5 `next/image` sites use; add `src/web/lib/dynamic.tsx` (a `next/dynamic`-compatible lazy wrapper, `ssr:false` → client-only); add `src/web/routes/nav-probe.tsx` exercising `useParams` + `useSearchParams` + `useRouter().push` + `<Link preload="intent">`.

> Shared-file ownership: **B owns `vite.config.mts`; A owns `src/web/lib/navigation/index.ts`.** No other agent edits those.

## typed-`useSearch` policy

The adapter's `useSearchParams` returns a Next-compatible `URLSearchParams`, so the 18 occurrences work unchanged. For **new `src/web` routes**, prefer TanStack's typed `useSearch` + route `validateSearch`; do NOT force-rewrite shared components. Document this one-liner in the spec; no code beyond the adapter here.

## Definition of Done / cf-canary

- [ ] `@/web/lib/navigation` exports all 5 contract APIs, Next-compatible.
- [ ] `vite.config.mts` aliases `next/navigation`/`next/link`/`next/image`/`next/dynamic`; CF build branch unchanged otherwise.
- [ ] `pnpm web:typecheck` + `pnpm web:build` green; live `pnpm typecheck` still 0 (coexistence).
- [ ] `cf.herocast.xyz/nav-probe` SSR-renders, `?q=` round-trips through `useSearchParams`, `useParams` resolves, a `<Link preload="intent">` and a programmatic `push` both navigate.
- [ ] Bundle still < 3 MB gzip. No `next/*` files edited.

## Gotchas (from `conventions.md`)
- Plugin order in `vite.config.mts` is fixed; aliases go in `resolve.alias`, not the plugin list.
- The alias is build-time; don't add `next` as a runtime dep to the TanStack tree.
- `import type` for types; no `@types/node` in this tsconfig.
- Don't touch the CF `cloudflare:workers` alias / `environments.client` block.

## Execution

Fan out **Areas A, B, C** to parallel agents in this workspace using the prompts below (each follows `conventions.md` → Agent execution protocol: log to `.context/02-nav/<area>.md`, do NOT commit). Then run the **integrator** to build, review (Tier-1 `/code-review` + Codex), commit, and flip this unit's status in `strategy.md`.
