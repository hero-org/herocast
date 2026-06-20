# Unit #6 — feeds + profile (CastRow + react-virtual)

> Track B / epic #754. The **first surface-tier unit** — it fans out from the foundation chain (`#5 ✅ app shell`) and is the prerequisite for `#7 (inbox/search)`. Mounts the two most-trafficked herocast pages — the multi-feed view and the user profile — onto the TanStack route tree as children of the `_app` shell, **reusing every shared component verbatim** through the unit-#2 `next/*` vite aliases and the unit-#10 `/api/*` worker data routes. Blocked-by: **#5 ✅** (which is blocked-by #2/#3/#4 ✅). Template: `phase-1.md`. Reuse contract: `conventions.md`.

## Objective

Render `/feeds`, `/profile`, and `/profile/<slug>` on the TanStack tree with **zero shared-component re-implementation and zero new data-fetching paths**:

1. `/feeds` — the full multi-feed surface (`app/(app)/feeds/page.tsx`, ~779 LOC): trending / following / channel / FID-list / search-list feeds, the split-pane shell + preview pane, the "N new casts" pill, infinite scroll via `react-intersection-observer`, keyboard nav + split-pane focus hotkeys, and `SelectableListWithHotkeys` (`@tanstack/react-virtual`).
2. `/profile` — the index redirect page (`app/(app)/profile/page.tsx`): pushes to the selected account's `/profile/<username>`.
3. `/profile/<slug>` — the profile page (`app/(app)/profile/[slug]/page.tsx` + `ProfileChannels.tsx`): `ProfileInfo`, the casts/replies/top/likes/channels tabs, and `CastRow` (which transitively mounts `Embeds → VideoEmbed`).

Data already works end-to-end: the `FarcasterProvider` seam (`src/lib/farcaster/providers/neynar.ts`) + the RQ feed/profile hooks (`src/hooks/queries/use*Feed.ts`, `useProfile`, `useProfileFeed`, `useUserChannels`) call the unit-#10 `/api/*` worker routes. This unit **reuses them as-is** — no hook/provider/route edits.

**The load-bearing decision (same as #5): the page *logic* is ported into `src/web/`, but every shared component it renders (`CastRow`, `CompactCastRow`, `SelectableListWithHotkeys`, `ProfileInfo`, `SplitPaneShell`, `PreviewPane`, `NewCastsPill`, the `Embeds/*` tree, the RQ hooks, the stores) is consumed VERBATIM.** The only edits to the port vs. the Next source are three surgical, SSR-mandated changes (below); the CLAUDE.md layout/virtualization rules hold automatically because the rendered markup is byte-identical to the live app.

## Non-goals

- **No new data layer.** The RQ hooks + `FarcasterProvider` + the #10 `/api/*` routes are reused unchanged. No `createServerFn`, no route loaders — feeds/profile fetch client-side via React Query exactly as on Next (the page SSRs its loading state; content paints after hydration + RQ resolves).
- **No editor work** (#8). The "Cast"/"Reply"/"Quote" actions open `NewCastModal`, which lazy-loads `NewCastEditor` via the `next/dynamic` shim (`ssr:false`, stubbed out of the worker bundle in #5). Making the editor *work* is #8; the feed actions just wire the modal open, as on Next.
- **No auth/onboarding** (#9). `CreateAccountPage`, the read-only upgrade cards, and the logged-out `/login` redirect are reused from the shell as-is.
- **No inbox/search/conversation** (#7) — the `/conversation/<hash>` deep-link target (mobile cast tap, legacy `?castHash=` redirect) 404s on the canary until #7 lands. Expected; the redirect/push code is ported intact so it lights up for free when #7 ships.
- **No virtualization rewrite.** `SelectableListWithHotkeys` already uses the `top`-positioned, `width:100%`/`position:absolute` virtual-item pattern (CLAUDE.md "Virtualization in Feeds") — it is reused verbatim, not re-authored.

## The three surgical changes vs. the Next source (everything else is byte-identical)

| # | Next source | Ported `src/web` form | Why |
|---|-------------|------------------------|-----|
| C1 | `import { … } from 'next/navigation'` | `import { … } from '@/web/lib/navigation'` | New `src/web` code imports the unit-#2 adapter **directly** (per `actions.ts`/`conventions.md`), not via the build alias indirection. Same runtime behavior. |
| C2 | `const supabaseClient = createClient();` **at module scope** (feeds, line 61) | deferred: `getSupabaseClient()` called **inside** the last-read-timestamp effect | `createClient()` at module scope **throws on workerd when env is absent** (forkability bar) → worker-init crash → `/feeds` 500s even for SSR. `getSupabaseClient()` is the conventions.md lazy seam for SSR-reachable code. |
| C3 | `'use client'` directive | removed | A Next App-Router directive; inert under TanStack. Dropped as noise (no behavior change). |

> Profile's module-scope `const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!)` is **left as-is** — `NEXT_PUBLIC_APP_FID` is in the #4 `define` allowlist, and `Number(undefined)` ⇒ `NaN` (no throw), exactly as audited in #5 (A2). No change needed.

## Route-tree topology (children added under `_app`)

```
_app.tsx                       <Home><Outlet/></Home>           (unit #5)
├── _app.shell-probe.tsx       /shell-probe                     (unit #5, throwaway)
├── _app.feeds.tsx             /feeds            ← this unit
├── _app.profile.index.tsx     /profile          ← this unit (index redirect)
└── _app.profile.$slug.tsx     /profile/$slug    ← this unit
```

`_app.profile.index.tsx` + `_app.profile.$slug.tsx` (no explicit `_app.profile.tsx`): TanStack flat-routing auto-creates the `/profile` parent; the `index` file serves the exact `/profile` path and `$slug` serves `/profile/<slug>`. The `$slug` param name matches the Next `[slug]` segment, so the unit-#2 `useParams()` adapter (`{ strict: false }` → `{ slug }`) feeds the ported page unchanged.

**SSR shape (a #5 invariant, restated):** `Home.pageRequiresHydrate` *excludes* `/profile*` but *includes* `/feeds`. So:
- `/feeds` SSRs the shell's `isHydrated=false` "Loading herocast" gate; the feed paints after client store hydration + RQ. (Correct — do not SSR-hydrate stores.)
- `/profile/<slug>` SSRs page content directly, but the page's own `isLoadingProfile` gate renders `<Loading/>` until `useProfile` (client RQ) resolves. **So `CastRow` → `VideoEmbed` never renders during SSR** on either route — which is what makes the worker-bundle stub (G1) safe.

## Files

- **New (page logic, ported):** `src/web/pages/FeedsPage.tsx`, `src/web/pages/ProfileIndexPage.tsx`, `src/web/pages/ProfilePage.tsx`, `src/web/pages/ProfileChannels.tsx`.
- **New (thin routes):** `src/web/routes/_app.feeds.tsx`, `src/web/routes/_app.profile.index.tsx`, `src/web/routes/_app.profile.$slug.tsx` — each `createFileRoute('/_app/<path>')({ component })` importing its `pages/` component (the established thin-route pattern: `_app.tsx` → `Home`).
- **New (this spec):** `docs/migration/phase-2-feeds-profile.md`.
- **Edit (migration-owned):** `vite.config.mts` (add `VideoEmbed` to `ssrClientOnlyModules` — G1), `docs/migration/strategy.md` (status: #10 → ✅; #6 → 🔍 + PR ref).
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, **and every shared `src/` file** (CastRow, hooks, stores, providers, the navigation adapter, the supabase seam). This unit edits nothing outside `src/web/` + the two migration-owned configs/docs.

## Reuse contract (per `conventions.md`)

- **Navigation:** `@/web/lib/navigation` (`useRouter`/`useSearchParams`/`useParams`) — the unit-#2 adapter, imported directly (C1).
- **Shell mount:** children of the `_app` pathless layout (unit #5) — never re-wrap in `Home`, never re-mount `CommandPalette`/`GlobalHotkeys`.
- **Data:** the `FarcasterProvider` seam + the existing RQ hooks → the #10 `/api/*` routes. No new fetch paths.
- **Supabase (browser):** `getSupabaseClient()` lazy singleton — never at module scope (C2).
- **`define` allowlist:** the ported pages read only `NEXT_PUBLIC_APP_FID` at module scope (already allowlisted, #4). No new public key is read at module scope ⇒ no `define` addition.
- **Bundle diet:** extend the existing `ssrClientOnlyStubPlugin` regex — do **not** fork a new stub mechanism (G1).

## Gotchas (this unit)

- **G1 — `CastRow` re-enters the worker bundle and drags the HLS chunk.** Mounting `CastRow`/`CompactCastRow` (feeds + profile) pulls `Embeds/index.tsx`, which **statically** imports `VideoEmbed`, which lazy-loads `@gumlet/react-hls-player` via the `next/dynamic` shim (`ssr:false`). A dynamic import is statically analyzable, so Rollup emits the HLS chunk into the **worker** bundle even though it never executes during SSR — the exact risk flagged by the #5 Tier-2 review. Fix: add `VideoEmbed` to `ssrClientOnlyModules` in `vite.config.mts` so the workerd (`ssr`) env resolves it to the throwing stub; the client bundle keeps the real module and code-splits the HLS player as before. **Regex note:** `Embeds/index.tsx` imports `'./VideoEmbed'` (relative), so the alternation entry is `VideoEmbed` (matches `/VideoEmbed$`), **not** `Embeds/VideoEmbed` (which would never match the relative specifier). Safe because `src/common/components/Embeds/VideoEmbed.tsx` is the only `VideoEmbed` module, and — per the SSR shape above — it never renders server-side, so the stub's throw is never hit. Re-check `web:deploy:dry-run` stays < 3 MB gzip after the change.
- **G2 — module-scope supabase throws on the forkability bar.** See C2. The deferral is what lets `/feeds` SSR 200 with no secrets.
- **G3 — virtualization is already correct; don't touch it.** `SelectableListWithHotkeys` uses `top` positioning (not `transform: translateY`, which breaks `%` width) with `width:100%`/`position:absolute` item wrappers (CLAUDE.md). It's reused verbatim — the canary must confirm rows recycle on scroll with no width collapse, but no code here changes it.
- **G4 — layout `min-h-0`/`flex-1` hold for free.** The shell's content slot (`flex-1 min-h-0 overflow-hidden`, `src/home/index.tsx`) + the pages' own `SplitPaneShell`/`SelectableListWithHotkeys` markup are byte-identical to the live app, so the recurring scroll-container bug class can't regress here.
- **G5 — route-tree typecheck is generated.** New routes fail `pnpm web:typecheck` (`'/feeds' not assignable to keyof FileRoutesByPath`) until `vite build` regenerates `routeTree.gen.ts`. **Build once, then typecheck** (same as #10).
- **G6 — `/conversation/*` is #7.** The mobile cast tap (`router.push('/conversation/<hash>')`) and the legacy `?castHash=` redirect target a route that doesn't exist yet → router not-found on the canary. Ported intact; lights up when #7 lands.

## Definition of Done / cf-canary (status as implemented)

- [x] `pnpm web:build` 0, `pnpm web:typecheck` 0 (after a build regenerates `routeTree.gen.ts`), live `pnpm typecheck` 0, `pnpm test` **150/150**.
- [x] Routes generated: `/_app/feeds`, `/_app/profile/` (index), `/_app/profile/$slug` (verified in `routeTree.gen.ts`).
- [x] **Worker bundle 2293 KiB gzip < 3 MB** (`web:deploy:dry-run`) — only **+4 KiB** over unit #5's 2289 KiB high-water mark despite mounting the whole `CastRow` graph: the G1 `VideoEmbed` stub kept the `@gumlet/react-hls-player` chunk out of the worker bundle (none present in `dist/server`; the real module ships in the client bundle as before). G1 verified.
- [x] **No secret VALUE in the client bundle.** `NEYNAR_API_KEY` name absent; `NEXT_PUBLIC_NEYNAR_API_KEY` / `NEXT_PUBLIC_APP_MNENOMIC` are `define`-pinned to `undefined` regardless of `.env` (so the TanStack client is *more* locked-down than live Next, which would inline a `NEXT_PUBLIC_` value — #751). See the note below on the one benign identifier match.
- [x] **Browser canary** (gstack `/browse`, real Chromium, local `web:serve` on workerd, 2026-06-20): `/profile/<slug>` hydrates and renders the full shell (herocast lockup, sidebar nav, "Profile" titlebar) with **zero console errors**, degrading to the page's own "Failed to load profile" error state on the 402 (graceful, no crash). `/feeds` hydrates → store init runs → AuthContext **client-redirects logged-out to the #5 `/login` placeholder** (evidences `initializeStoresProgressive()` ran). No React/invalid-hook/hydration-mismatch/missing-module errors on either; the only console output is the expected Neynar **402 quota passthrough** + pre-existing #3 WalletConnect warnings (`metadata.url` mismatch / double-init — not a #6 regression).
- [ ] **Real-data virtual scroll** — feed list populated with real casts + row recycling on a long scroll with no width collapse (G3). **Deferred: needs a quota'd `NEYNAR_API_KEY`** (the only un-green DoD item). The virtualization component (`SelectableListWithHotkeys`) is reused verbatim, has a passing regression test (`StandardCastRow.regression.test.tsx`), and its TanStack-tree mount/hydration is proven above; only live-data scrolling is unverified locally.

### Secret-grep heuristic — one benign identifier match (documented, not a leak)

The #4/#5 invariant greps the client bundle for the *names* `NEYNAR_API_KEY` / `APP_MNENOMIC`. After #6, `APP_MNENOMIC` appears once — as `APP_MNENOMIC=void 0`, a minified **identifier** (not a value) from `src/common/helpers/warpcastLogin.ts:37` (`const APP_MNENOMIC = process.env.NEXT_PUBLIC_APP_MNENOMIC`, RHS inlined to `undefined` by `define`). It is newly client-bundled because the feeds **empty-state reuses `CreateAccountPage` verbatim** (→ `warpcastLogin` → `generateKeyPair`) — exactly as the live Next feeds page imports it. The **secret value does not leak** (`void 0`); the name-grep heuristic simply now matches a `void 0`-valued local. No fix is in scope here (the helper is shared/`#9`-owned auth code; the feeds import is the verbatim live-app behavior). The right follow-up is to make the CI invariant grep for *values*, not names (see Follow-ups).

> **Neynar quota (HTTP 402):** the dev key is over its monthly CU allocation, so live feeds return the quota error (correct passthrough from the #10 routes). The DoD above is **forkability + render-path** focused; full real-data parity (real casts rendering through `CastRow`/`CompactCastRow`, virtual scroll over a long real feed) needs a **fresh quota'd `NEYNAR_API_KEY`** in `.dev.vars` — re-run the browser canary then, or verify post-`web:deploy`. Treat 402 as "needs a quota'd key", not a bug.

## Follow-ups surfaced (not fixed here)

- **[#7] `/conversation/<hash>`** is the un-ported deep-link target (G6) — lands with inbox/search/conversation.
- **[#8] Editor actions** (Cast/Reply/Quote from feeds) open `NewCastModal` but the editor itself is the #8 port; until then the modal renders the lazy stub's loading state on the canary.
- **[deploy] Real-data canary** needs a quota'd Neynar key — the one DoD item that can't be green locally on the over-quota dev key (shared with #10's open item).
- **[CI] gzip budget assertion.** `ssrClientOnlyModules` is now a 3-entry hand-maintained list (`WalletProviders`, `NewCastEditor`, `VideoEmbed`); a renamed import path silently re-enters the worker bundle and only fails at the 3 MB deploy gate. The #0/#5/#10 ask for a CI gzip budget + `/api/health` smoke stands.
- **[CI] secret invariant should grep VALUES, not names.** The current heuristic greps the client bundle for the *names* `NEYNAR_API_KEY`/`APP_MNENOMIC`; #6 surfaced a benign `APP_MNENOMIC=void 0` identifier match (see DoD note). Switch the CI check to assert no secret *value* is present (e.g. the `.env` `NEXT_PUBLIC_APP_MNENOMIC` / Neynar key strings never appear in `dist/client`) so it stops false-positiving on `void 0`-valued locals.
- **[#9/#751] `CreateAccountPage` pulls `warpcastLogin`/`generateKeyPair` (app-mnemonic keygen) into the feeds client chunk.** Harmless on the TanStack build (`APP_MNENOMIC` is `define`-pinned to `undefined`), but on the live Next app `NEXT_PUBLIC_APP_MNENOMIC` is a client-exposed var — a pre-existing live-app exposure to resolve when auth/accounts port (#9). Out of scope for #6 (verbatim reuse of the live empty-state).
- **[#13] Probe sweep** — no new probes added here (the pages are the real surface), but `/shell-probe` et al. remain on the cutover delete list.

## Tier-1 review (ran — clean)

Two independent passes on this unit's diff, **zero actionable code findings**:
- **`/code-review`** (high effort, recall-biased; line-by-line + removed-behavior + cross-file/config + cleanup angles): no bugs. Confirmed the C2 supabase deferral is behavior-preserving (`getSupabaseClient()` is a literal alias of `createClient()` sharing the same singleton + lazy-throw, now called *less* eagerly, after the `channelId` guard), `'use client'` removal is inert under TanStack, and the `VideoEmbed` regex matches the relative `./VideoEmbed` specifier without over-matching.
- **Dynamic multi-agent review workflow** (4 dimensions — ssr-bundle / parity / conventions / correctness — each finding adversarially verified): ssr-bundle 0, parity 0, correctness 0, conventions 1 **nit** (the #6 status cell flip — handled at PR-open, this section's sibling edit).
- **VideoEmbed SSR stub** flagged as a *fragility tripwire* (a future SSR'd `.m3u8` `CastRow` would hit the throwing stub) — verified unreachable today (feeds SSRs the hydrate gate; profile SSRs its own `<Loading/>` until client RQ) and it is the intended loud-fail signal for exactly that regression (G1).

(Tier-2 codex integration review runs at the surface-tier boundary after #6–#9 — not in this unit.)
</content>
</invoke>
