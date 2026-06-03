# UX Responsiveness + Data-Layer Roadmap

> **Status:** Spike / investigation (branch `claude/ux-responsiveness-tech-stack`). No feature code
> ships from this branch — this document is the deliverable, alongside the GitHub issues it links.

## Goal

Make herocast feel **native — sub-200ms perceived responsiveness** on the interactions that matter
most, and decide the long-term data-layer direction (stay on the full Supabase stack now vs. move to
a rawer, pooled Postgres later).

Priority surfaces (most-bothersome latency, in order): **cold start → feed switching → profile
navigation → notification UX**.

The framing used throughout: **Now** = this branch / tracked here · **Soon** = GitHub issues ·
**Later/Evaluate** = discovery issues · everything else = deliberately skipped.

---

## What's already in place (don't rebuild)

| Capability | Where | Notes |
|---|---|---|
| Optimistic likes / recasts / follows | `src/hooks/mutations/useCastActions.ts`, `useFollow.ts` | snapshot + rollback pattern — the template for the remaining optimistic work |
| React Query config | `src/lib/queryClient.ts` | `staleTime` 5m, `gcTime` 30m, retry×3 backoff, refetch on focus/reconnect |
| Query-key hierarchy + dedup | `src/lib/queryKeys.ts` | prefix-based invalidation, request coalescing |
| Phased store init | `src/stores/initializeStores.ts` | Phase 1 critical (~600ms), Phase 2 background (fire-and-forget) |
| Perf instrumentation | `src/stores/usePerformanceStore.ts` | `measureAsync`, `startTiming`/`endTiming`, `window.__perfSummary()`; `useNavigationPerf` |
| Loading skeletons | `PageSkeleton`, route `loading.tsx` | good coverage already |

## The specific gaps (verified against the code)

- ❌ **No persistent React Query cache** — in-memory only; feed blanks on refresh and re-fetches
  Neynar (7–8s). No `react-query-persist` / `persistQueryClient` in the repo. *(cold start)*
- ❌ **No `keepPreviousData` / `placeholderData`** anywhere — feed switch shows a blank frame. *(feed switching)*
- ❌ **No `prefetchQuery` on intent** — nav waits for the route to commit before fetching; links are
  `prefetch={false}`. *(profile navigation)*
- ⚠️ **Notification read-state coupled to a 5s debounce** — `SYNC_INTERVAL = 5000` /
  `debouncedSync()` in `src/stores/useNotificationStore.ts`. *(notification UX)*
- ❌ **No optimistic feed insertion** on publish — modal closes optimistically
  (`NewCastEditor.tsx`) but the feed cache isn't updated; own cast invisible until refresh.
- ⚠️ **Phase-1 init awaits ~3 Supabase round-trips** (~600ms) before interactive.

---

## NOW — this branch (tracked here, no feature code)

- ✅ This roadmap document (categorization + rationale + coupling map).
- ✅ Baseline benchmark **method** + first-pass estimates (below).
- ✅ ADR: *stay on Supabase now, evaluate rawer Postgres later* (below).
- ✅ Soon items filed as GitHub issues (linked below).

## SOON — GitHub issues (high-impact responsiveness primitives)

Ranked to the priority surfaces:

| # | Issue | Surface | Target |
|---|---|---|---|
| 1 | [#735 — Persist React Query cache to IndexedDB](https://github.com/hero-org/herocast/issues/735) | cold start | feed first-paint < 200ms (cached) vs 7–8s |
| 2 | [#736 — Instant feed switching (keepPreviousData + adjacent prefetch)](https://github.com/hero-org/herocast/issues/736) | feed switching | no blank frame; < 200ms |
| 3 | [#737 — Prefetch-on-intent for profile/cast nav](https://github.com/hero-org/herocast/issues/737) | profile nav | warm-hover nav < 200ms |
| 4 | [#738 — Snappy notification UX (optimistic read-state)](https://github.com/hero-org/herocast/issues/738) | notification UX | read-state change < 100ms |
| 5 | [#739 — Optimistic feed insertion on publish](https://github.com/hero-org/herocast/issues/739) | posting | own cast visible < 200ms |
| 6 | [#740 — Trim Phase-1 store init off critical path](https://github.com/hero-org/herocast/issues/740) | cold start | interactive < 200ms |
| 7 | [#741 — Optimistic account/channel mutations](https://github.com/hero-org/herocast/issues/741) | switching | pin/switch < 100ms |

**Suggested sequencing:** #735 first (biggest perceived win, unblocks the rest by making cache warm),
then #736 + #737 (the two prefetch/keep-previous primitives share machinery), then #738/#739/#741
(optimistic-state work, all reuse the `useCastActions` snapshot+rollback template), with #740 as a
parallel track on the init path.

## LATER / EVALUATE — discovery issues

- [#742 — Evaluate a rawer, pooled Postgres data layer vs. the full Supabase stack](https://github.com/hero-org/herocast/issues/742)
  (control / cost / devex / lock-in). See ADR below.
- **Route-level prefetch / service-worker offline shell** — revisit after #735 lands; the persistent
  cache covers most of the perceived benefit first. *(skip for now)*
- **Consolidate per-store IndexedDB databases** into one DB with multiple object stores — minor
  startup win, not worth it until the above are done. *(skip for now)*

---

## Baseline benchmark

Reuse existing instrumentation — **no new infra**. Method below is repeatable; run it on a
production-like build and paste the real numbers into the "Measured" column.

Capture in dev console with `window.__perfSummary()`, or in prod via PostHog `performance_metric`
events (`warning`/`critical` only).

| Surface | How to measure | Metric key | Est. today | Measured (TODO) | Target |
|---|---|---|---|---|---|
| Cold start (blank→feed) | hard-reload `/feeds`, read summary | `store-init-total`, `feed:following`/`feed:trending` | ~600ms init + 7–8s feed cold | _run_ | < 200ms (warm) |
| Profile navigation | click a profile from feed | `nav:/profile` (`useNavigationPerf`) | ~0.5–2s | _run_ | < 200ms |
| Feed switching | switch channel | wrap switch in a temporary `measureAsync('feed-switch')` | blank frame + fetch | _run_ | < 200ms |
| Notification UX | click a notification → read-state visible | manual timing / temp `measureAsync` | tied to 5s `SYNC_INTERVAL` for server, UI flip varies | _run_ | < 100ms |

> The "Est. today" column is derived from the instrumentation thresholds and code analysis, **not a
> live capture** — confirm with `__perfSummary()` on a real session before/after each Soon item.

---

## ADR: Stay on Supabase now, evaluate rawer Postgres later

**Decision:** Keep the full Supabase stack for now. Track the rawer/pooled-Postgres direction as a
discovery ([#742](https://github.com/hero-org/herocast/issues/742)); do not migrate on this branch.

**Why now is fine:** The responsiveness wins above are almost entirely **client-side** (cache
persistence, prefetch, optimistic state) and are independent of the database. They deliver the
sub-200ms feel without touching the backend.

**Coupling map (the swap surface):**
- Supabase is called via the **JS SDK directly** in Zustand stores and `src/common/helpers/supabase.ts`
  — there is **no data-access abstraction boundary** today.
- Zustand owns config/accounts/channels (IndexedDB + Supabase); React Query owns feed/profile data
  (Neynar). The two **don't overlap**, so a swap is scoped to the Supabase side only.
- **Supabase Auth** is on the critical path; RLS likely guards tables. Entities/migrations live in
  `src/lib/entities/` and `supabase/`.

**What a swap would require:** a thin data-access layer over the SDK call sites · connection pooling
(PgBouncer/Supavisor) · re-homing auth (or keeping Supabase Auth, swapping only the DB) · re-adding
retry/backoff · re-implementing RLS as app-layer authz.

**Cheap, reversible first step (recommended regardless):** introduce the data-access boundary so the
app stops calling the Supabase SDK directly. It improves testability today and de-risks any future
swap. Pursue under #742.

**Re-evaluate when:** a concrete pressure shows up — measured PostREST/edge latency on a hot path, a
cost cliff at scale, or a devex/lock-in blocker.
