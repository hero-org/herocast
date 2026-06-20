# Migration strategy — Next.js → TanStack Start on Cloudflare Workers

> The **map** for Track B of epic #754. Per-unit detail lives in `docs/migration/phase-N-*.md` specs (authored just-in-time; `phase-1.md` is the template + the proven foundation). The **reuse contract** lives in `conventions.md` — read it before touching any unit.

## What we're doing (two orthogonal axes)

1. **Framework:** Next.js 15 App Router → **TanStack Start (SSR)**. The heavy work. Strangler-fig: port unit by unit; each step independently shippable + reversible.
2. **Hosting:** Vercel → **Cloudflare Workers**. Largely a build-plugin swap — TanStack Start emits a universal `fetch` handler. Vercel-on-vite-7 is wired + live as of unit #1 (`web:build:vercel`; see `phase-1.md §0.1`).

**Safety net:** Next.js on **Vercel stays untouched and is the live app the entire time.** The TanStack app is a separate Worker (`herocast-web`) served at **`cf.herocast.xyz`**, grown route-by-route. Nothing here can break the Vercel build (separate build graph; `src/web` is excluded from the Next tsconfig).

## Operating model (how we execute)

- **Durable context lives in committed files; chats are disposable.** A fresh agent bootstraps from `strategy.md` + `conventions.md` + its unit spec — nothing else.
- **Unit = a Conductor workspace** (worktree + branch + fresh chat). This is the context-length fix: subdivide by workspace, not by overloading one chat.
- **Workflow = the pipeline *inside* a unit** (implement → isolated review → fix). Small units (canary, vite7, stores-pass) can run as a workflow in an existing chat without a dedicated workspace.
- **Two review tiers:**
  - **Tier 1 — per-unit, isolated, repeated:** `/code-review` (or a review workflow w/ adversarial verify) on *that unit's diff only*, looped until clean. Findings surface in Conductor's diff viewer / Checks panel (`DiffComment`).
  - **Tier 2 — integration, codex:** at each **phase boundary** (after the foundation chain #2–#5; after the surface tier; before cutover) a **codex subagent reviews the whole `cf.herocast.xyz` app across units** — hunts drift, duplication, `conventions.md` violations, slop, context-loss.
- **cf-canary verification (every unit):** `pnpm web:deploy` (or local `pnpm web:serve`) and exercise the ported surface at `cf.herocast.xyz`; Vercel stays the reversible fallback.

## Units (13)

Sizes leveled (S/M/L, none >~2× another). Status: ☐ todo · ◐ in-progress · 🔍 in-review · ✅ merged.

| # | Unit | Size | Status | Blocked by | Spec |
|---|------|------|--------|------------|------|
| — | **Phase 1 foundation** | — | ✅ | — | `phase-1.md` (PR #763) |
| 0 | infra: cf.herocast.xyz canary deploy + CI prebuild | S | ✅ | — | `phase-2-infra-canary.md` |
| 1 | chore: bump vite 6→7 (unblocks Vercel target) | S | ✅ | — | `phase-2-vite7.md` |
| 2 | port: `next/navigation` → TanStack adapter (54 sites) | L | ✅ | — *(gate)* | `phase-2-navigation-seam.md` |
| 3 | port: provider tree (wallet/posthog/persist/auth ctx) | L | ✅ | 2 | `phase-2-providers.md` |
| 4 | port: stores + RQ hooks SSR-safety pass | S–M | ✅ | 3 | `phase-2-stores-hooks.md` |
| 5 | port: app shell + sidebar + command palette | L | ✅ | 2,3,4 | `phase-2-shell.md` (PR #766) |
| 6 | port: feeds + profile (CastRow + react-virtual) | L | 🔍 | 5 | `phase-2-feeds-profile.md` (PR #768) |
| 7 | port: inbox + search + conversation | M–L | ☐ | 6 | `phase-2-inbox-search.md` |
| 8 | port: editor (TipTap) + embeds | L | ☐ | 3,5 | `phase-2-editor.md` |
| 9 | port: auth + accounts + onboarding (OAuth write) | L | ☐ | 3,5 | `phase-2-auth-accounts.md` |
| 10 | port: data API routes behind FarcasterProvider (~19) | L | ✅ | 0,4 | `phase-3-data-routes.md` (PR #767) |
| 11 | port: auth/onchain/proxy routes + trek-WASM | L | ☐ | 0,9 | `phase-3-auth-onchain-wasm.md` |
| 12 | port: standalone subtrees + CRUD *(tracking bucket — decompose when foundation lands)* | bucket | ☐ | 5,10,11 | `phase-2-standalone-surfaces.md` |
| 13 | cutover: default to TanStack, decommission Next | M | ☐ | all 5–12 | `phase-4-cutover.md` |

> #12 is intentionally a **bucket** (dms / spaces / miniapp / workspace + lists / channels / settings / upgrade). Split it into per-surface units once the foundation lands and the per-surface effort is concrete — pre-splitting now would be premature.

## Dependency graph

```
{#0 canary, #1 vite7}  ── parallel, do first ──┐
                                               │
#2 navigation seam (54 sites) ── critical-path gate, start now
        │
        └─► #3 provider tree ─► #4 stores/hooks ─► #5 app shell+sidebar
                                                        │
        ┌───────────────┬──────────────┬───────────────┤  (fan out once #5 on main)
        ▼               ▼              ▼               ▼
   #6 feeds+profile  #8 editor    #9 auth+accounts  (API tier, parallel:)
        │            (TipTap)     (OAuth write)      #0─►#10 data routes
        ▼                              │             #9─►#11 auth/onchain/WASM
   #7 inbox+search+conv                │
        └──────────────┬──────────────┘
                       ▼
              #12 standalone+CRUD bucket
                       ▼
              #13 CUTOVER (blocked by ALL #5–#12)
```

**Tackle order:** `{#0, #1, #2}` now → `#3 → #4 → #5` (foundation chain, merge to main between each) → surface tier `{#6→#7, #8, #9}` + API tier `{#10, #11}` concurrent → `#12` → `#13` last.

## Branching reality

Conductor branches each workspace from latest `origin/main`. The **sequential foundation chain (#2→#3→#4→#5) merges to main between units** (each next workspace branches from updated main). Once **#5 is on main**, the parallel-safe units (#6–#11) fan out into **concurrent workspaces** — that's where Conductor's parallel-agents model pays off.

## Per-unit workspace recipe

1. New Conductor workspace from `main` (branch e.g. `migration/02-navigation-seam`).
2. Paste the **kickoff prompt** (below) → agent reads `strategy.md` + `conventions.md`, authors/reads the unit spec.
3. Implement (workflow: fan-out → integrate).
4. **Tier-1 review** loop: `/code-review` on the diff until clean.
5. cf-canary verify.
6. Update this table's status → open PR → merge.
7. At phase boundaries, run the **Tier-2 codex integration review** (its own workspace or subagent).

### Kickoff prompt template (paste into each new workspace)

```
You are executing ONE unit of the herocast Next→TanStack-Start-on-Cloudflare migration.

READ FIRST (your only bootstrap context):
1. docs/migration/strategy.md      — the map + dep graph + this unit's row
2. docs/migration/conventions.md   — the REUSE CONTRACT. Reuse the named seams; do NOT reinvent them.
3. docs/migration/phase-1.md       — the proven foundation + load-bearing gotchas (§0, §6)

YOUR UNIT: #<N> — <title>
- Author docs/migration/<spec-file>.md first (use phase-1.md as the template): objective, non-goals,
  definition-of-done, the exact files in/out, reuse list, gotchas, cf-canary acceptance.
- Then implement IN-PLACE under src/web/ (never touch app/, pages/, next.config.mjs, vercel.json, src/globals.css).
- Honor conventions.md: .server.ts boundary, withCacheAPI/CacheBackend, the navigation adapter, serverEnv,
  the primitives, the FarcasterProvider seam. Do NOT duplicate an existing seam.
- Keep the CF build green: `pnpm web:typecheck` + `pnpm web:build` + (live) `pnpm typecheck` must all stay 0.
- Tier-1 review: run /code-review on your diff and fix until clean.
- Verify on the canary: `pnpm web:serve` (node ≥22) → exercise the surface at the probe/route.
- Update the status cell in strategy.md, then open a PR.

Do NOT start work that another unit owns (check the table's Blocked-by). Ask if scope is ambiguous.
```

## Phase boundaries → Tier-2 codex integration review

Run a codex subagent across the whole `src/web` tree (not a single diff) at:
- **After #2–#5 (foundation chain):** is the shared substrate coherent? any duplicated nav/env/cache logic?
- **After the surface tier (#6–#9):** do surfaces reuse CastRow/editor/providers, or re-implement? slop check.
- **Before #13 cutover:** full parity + duplication + dead-code sweep; resolve the Tauri consumer question (`phase-1.md §10`).

## Deferred / known follow-ups (surfaced during units; not yet fixed)

- **[#9 auth/accounts] `src/common/helpers/rainbowkit.tsx:9` reads `process.env.NEXT_PUBLIC_ALCHEMY_API_KEY` at module scope → `undefined` under Vite** (not inlined), so wagmi transports resolve to `…/v2/undefined`. The wallet modal still *opens* (so it didn't block #3), but RPC calls fail. Fix when porting wallet functionality: make it host-agnostic (`import.meta.env.VITE_ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY`) — it's a *shared* file so the change must keep the Next build working. Add `VITE_ALCHEMY_API_KEY` to `.env.local.example`. (Same class as the PostHog `VITE_*` fix in #3.)
- **[cutover/#13] Revisit `noImplicitAny`.** #3 set `tsconfig.tanstack.json` `noImplicitAny: false` to match the root Next tsconfig (the reused `src/` carries pre-existing implicit-anys). `strictNullChecks` etc. stay on. Once the shared graph is typed, consider a stricter `src/web/**`-only sub-project to restore `noImplicitAny` for *new* code without forcing it on reused code.

## Links
- `conventions.md` — reuse contract + gotchas (read before every unit)
- `phase-1.md` — foundation spec + proven patterns
- Epic: hero-org/herocast#754 · Phase 1: PR #763
