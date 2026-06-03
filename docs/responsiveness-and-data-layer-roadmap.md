# UX Responsiveness + Data-Layer Roadmap

> **Status:** Spike / investigation (branch `claude/ux-responsiveness-tech-stack`). No feature code
> ships from this branch — this document + the linked GitHub issues are the deliverable.
>
> **Decision (this session):** Pursue **native sub-200ms feel** via two tracks — (A) stack-independent
> responsiveness primitives shipped now, and (B) a phased **migration off Next.js 15 → TanStack Start
> (SSR + server functions)**. Keep the Supabase + Neynar data layer for now. Measure **both** perceived
> interaction latency (INP) **and** server round-trip latency.

## Goal

Make herocast feel **native — sub-200ms perceived responsiveness** on the interactions that matter
most: **cold start → feed switching → profile navigation → notification UX**.

## Architecture decision

**Migrate Next.js 15 App Router → TanStack Start (SSR).** Drivers (this session):
- Framework-native **loaders + intent preloading** (snappy nav).
- **Type-safe routing + typed search-param state** (DX upgrade App Router can't match).
- **Escape Next/Vercel coupling** — the same control / devex / lock-in motivation behind the
  raw-Postgres question (#742). The router migration addresses the *framework* half of that itch.
- _[Additional driver from owner — TBD, see Open Questions.]_

**Not chosen:** Vite SPA + Router (we want SSR), sync-engine/local-first rewrite (deferred — see #742),
and pure-incremental-on-Next (the lock-in driver justifies the move).

**Migration size (measured against the repo):** 25 page routes · 17 layout/loading/error files ·
104 files importing `next/*` · 31 API routes (23 server-coupled: `maxDuration`, service-role keys,
edge/runtime). The 31 API routes map to TanStack Start **server functions**. No Tauri currently wired
(`output: 'export'` is commented in `next.config`).

---

## What's already in place (don't rebuild)

| Capability | Where | Notes |
|---|---|---|
| TanStack Query v5 + Virtual | `@tanstack/react-query` ^5.90, `@tanstack/react-virtual` ^3.13 | **already the data layer** — comes with us to Start |
| Optimistic likes / recasts / follows | `src/hooks/mutations/useCastActions.ts`, `useFollow.ts` | snapshot + rollback — the template for remaining optimistic work |
| Query config | `src/lib/queryClient.ts` | `staleTime` 5m, `gcTime` 30m, retry×3 |
| Query-key hierarchy | `src/lib/queryKeys.ts` | prefix invalidation, dedup |
| Phased store init | `src/stores/initializeStores.ts` | Phase 1 ~600ms, Phase 2 background |
| Perf instrumentation | `src/stores/usePerformanceStore.ts` | `measureAsync`, `__perfSummary()`, `useNavigationPerf` |

## Verified gaps

- ❌ No persistent Query cache (no `persistQueryClient` in repo) — feed blanks on refresh. *(cold start)*
- ❌ No `keepPreviousData`/`placeholderData` anywhere — blank frame on feed switch. *(feed switching)*
- ❌ No `prefetchQuery` on intent; links are `prefetch={false}`. *(profile nav — dissolves into Start)*
- ⚠️ Notification read-state coupled to `SYNC_INTERVAL = 5000`ms debounce (`useNotificationStore.ts`). *(notifications)*
- ❌ No optimistic feed insertion on publish (`NewCastEditor.tsx` closes modal but doesn't update cache).
- ⚠️ Phase-1 init awaits ~3 Supabase round-trips (~600ms) before interactive.
- ❌ No INP / action-to-paint measurement — we currently only measure server round-trips.

---

## NOW — this branch (tracked here, no feature code)

- ✅ This roadmap (architecture decision + tracks + coupling map).
- ✅ Measurement plan (INP + server, below).
- ✅ Updated ADR (below).
- Issues reframed to match (#736/#737 folded into Track B; #742 linked to lock-in).

## SOON — Track A: responsiveness primitives (current stack, port to Start unchanged)

Ship these **now** — they're Query/Zustand-level and survive the migration.

| # | Issue | Surface | Target |
|---|---|---|---|
| 1 | [#735 — Persist Query cache to IndexedDB](https://github.com/hero-org/herocast/issues/735) | cold start | feed first-paint < 200ms (cached) |
| 2 | [#736 — `keepPreviousData` for feed switch](https://github.com/hero-org/herocast/issues/736) | feed switching | no blank frame (the prefetch half moves to Track B) |
| 3 | [#738 — Optimistic notification read-state](https://github.com/hero-org/herocast/issues/738) | notifications | read-state change < 100ms |
| 4 | [#739 — Optimistic feed insertion on publish](https://github.com/hero-org/herocast/issues/739) | posting | own cast visible < 200ms |
| 5 | [#740 — Trim Phase-1 init off critical path](https://github.com/hero-org/herocast/issues/740) | cold start | interactive < 200ms |
| 6 | [#741 — Optimistic account/channel mutations](https://github.com/hero-org/herocast/issues/741) | switching | pin/switch < 100ms |
| 7 | **INP / action-to-paint instrumentation** *(proposed — not yet filed)* | all | the measurement contract |

## SOON/LATER — Track B: TanStack Start migration (phased epic)

*(proposed epic — not yet filed; pending go-ahead)*

- **Phase 0 — Spike:** one route + auth + one API-route-as-server-function end-to-end on Start; validate
  SSR, Sentry/PostHog, and the build. Decide go/no-go with evidence.
- **Phase 1 — Foundation:** Start app shell, root route, auth, providers (Query, themes), `next/font` +
  `next/image` replacements.
- **Phase 2 — Routes:** port 25 pages to the typed route tree; loaders + `preload="intent"` deliver
  intent-prefetch natively (**absorbs #737 and the prefetch half of #736**).
- **Phase 3 — Server functions:** migrate 31 API routes (23 server-coupled) to Start server functions.
- **Phase 4 — Cutover & cleanup:** remove `next/*` (104 sites), Vercel-specific config, decommission.

## LATER / EVALUATE

- [#742 — Rawer/pooled Postgres vs full Supabase](https://github.com/hero-org/herocast/issues/742) —
  **the data-layer half of the same lock-in motivation.** Re-evaluate *after* Start lands; a sync engine
  (ElectricSQL / Zero) pairs naturally with a post-Start architecture if we revisit "native by construction."
- Service-worker offline shell; consolidate per-store IndexedDB DBs. *(skip for now)*

---

## Measurement plan (both layers)

Add `web-vitals` `onINP()`, tag interactions on the six priority flows, and route results into the
existing `usePerformanceStore` so **INP (perceived)** and **server round-trip** metrics sit side by side.
INP is the "native feel" contract; server metrics become the "is background sync healthy" view.

| Flow | Primary (INP, perceived) | Secondary (server) | Target |
|---|---|---|---|
| Open profile | tap → first content paint | `nav:/profile` | < 200ms |
| Switch feed | tap → new feed painted | feed fetch duration | < 200ms |
| Like / recast | tap → icon flip | reaction POST | < 100ms |
| Publish | submit → cast in feed | publish POST | < 200ms |
| Open notification | tap → read-state flip | sync (`SYNC_INTERVAL`) | < 100ms |
| Cold start | reload → feed visible | `store-init-*`, `feed:*` | < 200ms (warm) |

> **Why this matters:** once #735 lands, the user perceives <200ms while `feed:following` *still reports
> 7s* (background refetch). Optimizing toward the server metric alone would mislead us — INP is what
> tracks the goal. Capture via `__perfSummary()` (dev) / PostHog `performance_metric` (prod).

To run locally: check out this branch, `pnpm dev`, exercise the six flows, read `window.__perfSummary()`.
*(INP rows require the instrumentation in Track A item 7 first — without it we'd only see server numbers.)*

---

## ADR: Migrate to TanStack Start; keep Supabase data layer for now

**Decision:** Migrate the framework Next.js → TanStack Start (phased). Keep Supabase + Neynar as the
data layer. Track responsiveness primitives independently and ship them on the current stack first.

**Why split the framework and data decisions:** the lock-in/devex/control motivation applies to *both*
Next/Vercel and the full Supabase stack — but they're separable. The framework migration (Start)
addresses the larger day-to-day surface now; the data-layer question (#742) stays open and is best
revisited *after* Start, when a sync-engine option could be evaluated against the new architecture.

**Why responsiveness ≠ migration:** the primitives that deliver sub-200ms (#735, #738–#741) are
Query/Zustand-level and ship today, porting to Start unchanged. Only router-level prefetch (#736/#737)
waits for Start — and it comes for free there.

**Risk:** TanStack Start is comparatively young; 31 server-coupled API routes + Sentry/PostHog are real
migration surface. Mitigation: Phase 0 spike with a go/no-go gate before committing the full port.

---

## Open questions

- **The "something else" driver** behind the Start move (owner flagged one beyond prefetch / DX /
  lock-in) — capture it so it's reflected in the epic's scope and success criteria.
- **Go-ahead to file** the two proposed issues: Track A item 7 (INP instrumentation) and the Track B
  TanStack Start epic.
