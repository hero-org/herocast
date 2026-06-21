# Unit #7 — inbox + search + conversation

> Track B / epic #754. The **second surface-tier unit** — it fans out from `#6 ✅ feeds+profile` (CastRow + react-virtual + the `_app` shell) and **closes #6's one dangling deep-link**: `/conversation/<hash>`, the target of the mobile cast tap AND the legacy `?castHash=` redirect that #6 ported intact. Mounts three more herocast pages — the notifications inbox, the keyword search surface, and the single-cast conversation/thread view — onto the TanStack route tree, **reusing every shared component verbatim** through the unit-#2 `next/*` vite aliases and the unit-#10 `/api/*` worker data routes. Blocked-by: **#6 ✅**. Template: `phase-2-feeds-profile.md`. Reuse contract: `conventions.md`.

## Objective

Render `/inbox`, `/search`, and `/conversation/<hash>` on the TanStack tree with **zero shared-component re-implementation and zero new data-fetching paths**:

1. `/inbox` — the notifications surface (`app/(app)/inbox/page.tsx`, ~1195 LOC): the 5 notification tabs (replies / mentions / likes / recasts / follows) with per-tab cursors + unread badges, the split list/detail pane, `SelectableListWithHotkeys` (`@tanstack/react-virtual`), `CastRow` for the selected/parent cast, auto-refresh + infinite scroll, the full keyboard map (r/q/o/1–5/tab/e/…), and the reply/quote actions that open `NewCastModal`.
2. `/search` — the keyword search surface (`app/(app)/search/page.tsx`, ~298 LOC): `SearchInterface` (term + filters), `SearchResultsView`, save-as-list, the `?search=`/`?list=` URL bootstrap, and the inline `CastThreadView` when a result is opened. Data via the `useCastSearchInfinite` RQ hook.
3. `/conversation/<hash>` — the single-cast thread view (`app/conversation/[...slug]/page.tsx` + `app/conversation/layout.tsx`): resolves a cast by hash (or by `<user>/<hash>` → warpcast URL) and renders `CastThreadView` inside `PreviewEmbedContext`. **This is the #6 deep-link target.**

Data already works end-to-end: the `FarcasterProvider` seam (`src/lib/farcaster/providers/neynar.ts`) + the existing RQ/store paths call the unit-#10 `/api/*` worker routes. This unit **reuses them as-is** — no hook/provider/route edits.

- Inbox: `getProvider().getNotifications()` → `/api/notifications`; `getProvider().getCasts()` → `/api/casts` (parent-cast lookup). Plus `useNotificationStore` (read-state, Supabase sync).
- Search: `useCastSearchInfinite()` → `/api/search`.
- Conversation: `getProvider().getCastByIdentifier()` → `/api/casts/lookup`; `CastThreadView` internally → `/api/casts/conversation`.

All four routes (`notifications`, `casts`, `search`, `casts/lookup` + the transitive `casts/conversation`) are among unit #10's 19 ✅.

**The load-bearing decision (same as #5/#6): the page *logic* is ported into `src/web/`, but every shared component it renders (`CastRow`, `CastThreadView`, `SelectableListWithHotkeys`, `SearchInterface`, `SearchResultsView`, `PreviewEmbedContext`, the `Embeds/*` tree, the stores, the RQ hook) is consumed VERBATIM.** The only edits to the port vs. the Next source are the surgical, framework-mandated changes (below); the CLAUDE.md layout/virtualization rules hold automatically because the rendered markup is byte-identical to the live app.

## Non-goals

- **No new data layer.** The provider/RQ/store paths + the #10 `/api/*` routes are reused unchanged. No `createServerFn`, no route loaders — inbox/search/conversation fetch client-side exactly as on Next.
- **No editor work** (#8). Inbox's `r`/`q` (reply/quote) open `NewCastModal`, which lazy-loads `NewCastEditor` via the `next/dynamic` shim (`ssr:false`, stubbed out of the worker bundle in #5). Making the editor *work* is #8; the inbox actions just wire the modal open, as on Next.
- **No auth/onboarding** (#9). The logged-out states (`Please connect an account…` in inbox; the shell's `/login` client redirect for hydrate routes) are reused as-is.
- **No DMs** (#12). `/dms` is a separate bucket surface; "inbox" here is notifications only.
- **No virtualization rewrite.** `SelectableListWithHotkeys` is reused verbatim (the `top`-positioned, `width:100%`/`position:absolute` virtual-item pattern — CLAUDE.md).

## The surgical changes vs. the Next source (everything else is byte-identical)

| # | Next source | Ported `src/web` form | Why |
|---|-------------|------------------------|-----|
| C1 | `import { … } from 'next/navigation'` | `import { … } from '@/web/lib/navigation'` | New `src/web` code imports the unit-#2 adapter **directly** (per `conventions.md`), not via the build-alias indirection. Same runtime behavior. (`useRouter`/`useSearchParams` in inbox; `useRouter` in search; `useParams` in conversation.) |
| C3 | `'use client'` directive (+ the vestigial `/* eslint-disable @next/next/no-img-element */` in search) | removed | Next App-Router-specific directives, inert under TanStack. The search eslint-disable is vestigial (no `<img>` in the file) Next-eslint noise — dropped with `'use client'`. No behavior change. |
| **C4** | `const slug = params.slug as string[]` (conversation only) | `const slug = ((params._splat as string \| undefined) ?? '').split('/').filter(Boolean)` | **TanStack splat ≠ Next catch-all.** The Next route is `[...slug]` (array param `slug`); the TanStack equivalent is a `$` splat route whose param is `_splat` — a single `"a/b"` string. Rebuilding the segment array keeps `getPayloadFromSlug` + the `slug?.join('/')` effect dep byte-identical. **Behavior-preserving** (both 1-seg `<hash>` and 2-seg `<user>/<hash>` forms still parse). |

> **C2 (the #6 module-scope `createClient()` deferral) does NOT apply here** — none of the three pages create a Supabase client at module scope. The only notable module-scope reads are inbox's pure `parentCastCache = new Map()` / `CACHE_TTL` (no env, no throw) and search's `const APP_FID = process.env.NEXT_PUBLIC_APP_FID!` — left as-is, exactly as #6 left profile's `APP_FID` (`NEXT_PUBLIC_APP_FID` is in the #4 `define` allowlist; unset ⇒ literal `undefined`, no throw).
>
> **`next/link` is left as `next/link`** (inbox + conversation). It resolves to `@/web/components/link.tsx` via the unit-#2 build alias (and to real Next types under `tsc`), exactly as the shared components do. The `conventions.md` "Do NOT" list only forbids leaving **`next/navigation`** un-adapted; `next/link`/`next/image`/`next/dynamic` ride the build alias (matching #6, which changed only `next/navigation`).

## Route-tree topology (children added under `_app`)

```
_app.tsx                       <Home><Outlet/></Home>           (unit #5)
├── _app.feeds.tsx             /feeds                           (unit #6)
├── _app.profile.index.tsx     /profile                         (unit #6)
├── _app.profile.$slug.tsx     /profile/$slug                   (unit #6)
├── _app.inbox.tsx             /inbox             ← this unit
├── _app.search.tsx            /search            ← this unit
└── _app.conversation.$.tsx    /conversation/*    ← this unit (SPLAT, see C4)
```

`_app.conversation.$.tsx` is a **splat** route (`$` segment → matches `/conversation/<anything>`), the TanStack analogue of the Next `[...slug]` catch-all. The Next `conversation/layout.tsx` wraps children in `<Home>`, so mounting under `_app` (which renders `<Home><Outlet/></Home>`) reproduces the same chrome — no separate layout needed.

**SSR shape (the #5/#6 invariant, restated):** `Home.pageRequiresHydrate` *excludes* `/conversation*` (and `/profile*`, `/analytics*`) but *includes* `/inbox` and `/search`. So:
- `/inbox` + `/search` SSR the shell's `isHydrated=false` "Loading herocast" gate; content paints after client store hydration + the data fetch. (Correct — do not SSR-hydrate stores.)
- `/conversation/<hash>` SSRs page content directly, but the page's own `status==='loading'` gate renders the `PageSkeleton` until `getCastByIdentifier` (client) resolves. **So `CastThreadView` → `CastRow` → `VideoEmbed` never renders during SSR**, which keeps the #6 worker-bundle stub (G1) safe on this route too.

The shell lights up correctly by **pathname match** (no shell edits): `getSidebarForPathname` → `/inbox`/`/conversation/` ⇒ `CAST_INFO`, `/search` ⇒ `SEARCH`; `getTitle` → `Conversation` for `/conversation/`; inbox/search nav items already exist in `navigationGroups`.

## Files

- **New (page logic, ported):** `src/web/pages/InboxPage.tsx`, `src/web/pages/SearchPage.tsx`, `src/web/pages/ConversationPage.tsx`.
- **New (thin routes):** `src/web/routes/_app.inbox.tsx`, `src/web/routes/_app.search.tsx`, `src/web/routes/_app.conversation.$.tsx` — each `createFileRoute('/_app/<path>')({ component })` importing its `pages/` component.
- **New (this spec):** `docs/migration/phase-2-inbox-search.md`.
- **Edit (migration-owned):** `docs/migration/strategy.md` (status: #6 → ✅ + PR #768; #7 → 🔍 + PR ref).
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, **`vite.config.mts`** (no new `ssr:false` heavyweight ⇒ no `ssrClientOnlyModules` addition — see G2), and **every shared `src/` file** (CastRow, CastThreadView, SelectableListWithHotkeys, SearchInterface/SearchResultsView, the hooks, the stores, the provider, the navigation adapter). This unit edits nothing outside `src/web/` + the two migration-owned docs.

## Reuse contract (per `conventions.md`)

- **Navigation:** `@/web/lib/navigation` (`useRouter`/`useSearchParams`/`useParams`) — the unit-#2 adapter, imported directly (C1).
- **Shell mount:** children of the `_app` pathless layout (unit #5) — never re-wrap in `Home`, never re-mount `CommandPalette`/`GlobalHotkeys`.
- **Data:** the `FarcasterProvider` seam + the existing provider/RQ/store paths → the #10 `/api/*` routes. No new fetch paths.
- **`define` allowlist:** the ported pages read only `NEXT_PUBLIC_APP_FID` at module scope (already allowlisted, #4). No new public key is read at module scope ⇒ no `define` addition.
- **Bundle diet:** the `ssrClientOnlyModules` stub (`WalletProviders`, `NewCastEditor`, `VideoEmbed`) already covers everything CastRow/CastThreadView drag. This unit adds no new `ssr:false` module ⇒ no regex change (G2).

## Gotchas (this unit)

- **G1 — TanStack splat vs Next catch-all (C4, load-bearing).** `app/conversation/[...slug]` is a catch-all; its `useParams().slug` is a `string[]`. TanStack's equivalent is the `$` splat route, whose param is `_splat` — a single `/`-joined string, NOT an array, and NOT named `slug`. The unit-#2 `useParams` adapter is a pass-through (it does not transform splat into an array — its `string[]` type union only keeps Next call sites that annotate `string[]` compiling). So the page MUST rebuild the array from `_splat` (C4). Naming the route `_app.conversation.$hash.tsx` (single segment) would have dropped the 2-segment `<user>/<hash>` form — a parity regression; the splat preserves both. Empty splat (`/conversation` with no hash) falls through to the page's existing `not-found` state (graceful; Next's required catch-all would 404 — a benign difference).
- **G2 — no new worker-bundle risk.** Inbox/conversation mount `CastRow`/`CastThreadView` → `Embeds/index.tsx` → `VideoEmbed`, already stubbed out of the `ssr`/workerd bundle by #6's `ssrClientOnlyModules`. No NEW `ssr:false` heavyweight is introduced (`NewCastModal`→`NewCastEditor` is the #5 stub; search/conversation pull no wallet/editor chunk). Re-checked `web:deploy:dry-run` stays < 3 MB gzip after mounting — see DoD. Only add to the regex if a future `ssr:false` module appears.
- **G3 — `/conversation` SSRs content; the loading gate keeps `CastThreadView` off the server.** Because `/conversation*` is excluded from `pageRequiresHydrate`, the shell renders page content during SSR. But `ConversationPage` returns the `PageSkeleton` while `status==='loading'` (the initial state; the fetch only runs in a client `useEffect`), so `CastThreadView`/`CastRow`/`VideoEmbed` never execute server-side — the G2 stub's throw is never reached. (Same shape as #6 profile's `<Loading/>` gate.)
- **G4 — virtualization + layout hold for free.** `SelectableListWithHotkeys` (inbox) is reused verbatim (the `top`-positioned virtual-item pattern), and the pages' `min-h-0`/`flex-1`/`overflow` markup is byte-identical to the live app, so the recurring scroll-container bug class can't regress here.
- **G5 — route-tree typecheck is generated.** New routes fail `pnpm web:typecheck` (`'/inbox' not assignable to keyof FileRoutesByPath`) until `vite build` regenerates `routeTree.gen.ts`. **Build once, then typecheck** (same as #6/#10).
- **G6 — INP already wired.** `inp:open-notification` (inbox `selectNotification` → `trackInteractionToPaint`) is in the reused page code; no INP work added here.

## Definition of Done / cf-canary

- [ ] `pnpm web:build` 0 → `pnpm web:typecheck` 0 (after the build regenerates `routeTree.gen.ts`) → live `pnpm typecheck` 0 → `pnpm test` passing.
- [ ] Routes generated: `/_app/inbox`, `/_app/search`, `/_app/conversation/$` (verified in `routeTree.gen.ts`).
- [ ] **Worker bundle < 3 MB gzip** (`web:deploy:dry-run`) — expected ≈ #6's 2293 KiB high-water mark (no new `ssr:false` chunk; CastRow/VideoEmbed graph already accounted for in #6).
- [ ] **No secret VALUE in the client bundle** (#4/#5/#6 invariant holds — no new secret read).
- [ ] **Real workerd SSR 200** (`pnpm web:serve`, node ≥22): `/inbox`, `/search`, `/conversation/<hash>` all SSR 200 with no import-time throw; `/conversation/<hash>` SSRs the page skeleton (content gated to client).
- [ ] **Browser canary** (real Chromium on `web:serve`): inbox tabs + virtual list render and recycle on scroll; search interface accepts input and renders results/empty/loading; conversation thread view loads; sidebar/titlebar/nav correct per pathname; no React/hydration/missing-module errors (the Neynar **402 quota passthrough** is expected, not a bug).

> **Neynar quota (HTTP 402):** the dev key is over its monthly CU allocation, so live data returns the quota error (correct passthrough from the #10 routes). The DoD is **forkability + render-path** focused; full real-data parity (real notifications/search results/threads through the components, virtual scroll over a long real list) needs a **fresh quota'd `NEYNAR_API_KEY`** in `.dev.vars` — re-run the browser canary then, or verify post-`web:deploy`. Treat 402 as "needs a quota'd key", not a bug. (Shared open item with #6/#10.)

## Follow-ups surfaced (not fixed here)

- **[#8] Editor actions** (inbox reply/quote) open `NewCastModal` but the editor itself is the #8 port; until then the modal renders the lazy stub's loading state on the canary.
- **[deploy] Real-data canary** needs a quota'd Neynar key — the DoD items that can't be green locally on the over-quota dev key (shared with #6/#10).
- **[CI] gzip budget + secret-VALUE grep** — the standing #0/#5/#6/#10 ask (assert a gzip budget + an `/api/health` smoke in the #0 prebuild; switch the secret invariant to grep VALUES not names) still stands; unchanged by this unit.
- **[#13] No new probes** — the three pages are the real surface; the cutover delete list is unchanged.

## Tier-1 review (ran — clean)

A dynamic multi-agent review workflow on this unit's diff, **4 dimensions** (parity / ssr-bundle / conventions / correctness), each finding adversarially verified by an independent skeptic prompted to refute it: **0 raw findings, 0 confirmed** across all four. Specifically confirmed:

- **parity** — the three ported pages are byte-identical to their Next sources except the documented C1/C3/C4 surgical changes; no dropped/added logic, JSX, effect deps, hotkeys, or data calls. The C4 slug rebuild is behavior-preserving vs `params.slug as string[]`.
- **ssr-bundle** — no module-scope throw on workerd (inbox's `parentCastCache`/`CACHE_TTL` are pure; search's `APP_FID` read is `define`-allowlisted), no new secret read, no new `ssr:false` heavyweight (CastRow→Embeds→VideoEmbed already stubbed by #6).
- **conventions** — diff touches only `src/web/**` + the two migration-owned docs (route tree is gitignored/generated); navigation via `@/web/lib/navigation`; no `Home` re-wrap / palette re-mount; no new data path; thin routes match the `_app.feeds.tsx` pattern with correct `createFileRoute` ids.
- **correctness** — `_app.conversation.$.tsx` is the splat analogue of the Next `[...slug]` catch-all and serves both 1-seg and 2-seg forms; the `_splat`→array rebuild matches Next semantics for empty/1-seg/2-seg; the page reads `params._splat`; route wiring + default-import are correct; no new render loop.

(Tier-2 codex integration review runs at the surface-tier boundary after #6–#9 — not in this unit.)
