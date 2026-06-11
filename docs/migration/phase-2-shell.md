# Unit #5 — app shell + sidebar + command palette

> Track B / epic #754. Foundation chain `#4 ✅ → #5` (last unit before the surface tier fans out). Mounts the real herocast app chrome — the `src/home` layout (left sidebar, titlebar, right-sidebar slots), the command palette, and global hotkeys — onto the TanStack route tree, and wires `initializeStoresProgressive()` as a client-mount effect. Blocked-by: **#2 ✅, #3 ✅, #4 ✅**. Template: `phase-1.md`. Reuse contract: `conventions.md`.

## Objective

Stand up the **shared app shell** on the TanStack tree so the page units (#6 feeds/profile, #7 inbox/search, #8 editor, #9 auth/accounts, #12 bucket) port *pages into a working chrome* instead of each re-mounting it:

1. A **pathless layout route `_app`** (the `app/(app)/layout.tsx` equivalent) renders the untouched `src/home/index.tsx` shell — mobile drawer + fixed desktop sidebar (`LeftSidebarNav`, `AccountSwitcher`), titlebar with per-route title/actions, right-sidebar slot, `NewCastModal`, `Toaster`, `LiveSpaceBar` gate — around an `<Outlet/>`.
2. The **root chrome** (`GlobalHotkeys`, `CommandPalette`, `PerfPanel`) mounts in `__root.tsx` inside `<Providers>`, mirroring `app/layout.tsx` exactly (palette available on every route, incl. `/login`).
3. **Store hydration**: `Home` already calls `useInitializeStores()`, whose `useEffect` runs `initializeStoresProgressive()` on the client after the Supabase user resolves — **never during SSR** by construction (unit #4 proved importability only; this unit wires the call).

**The load-bearing decision: ZERO shell re-implementation and ZERO shared-file edits.** `src/home/index.tsx`, every `Sidebar/*` component, and `CommandPalette/*` are consumed **verbatim** through the unit-#2 build seams (`next/navigation`/`next/link`/`next/image`/`next/dynamic` vite aliases → the `src/web` adapters). The CLAUDE.md layout rules (`min-h-0`/`flex-1`) hold automatically because the markup is byte-identical to the live app.

## Non-goals

- **No real pages.** `/feeds`, `/inbox`, `/post`, etc. stay un-routed (units #6–#9, #12). Sidebar links to them 404 to the router's default not-found until those units land — expected.
- **No editor port.** `NewCastModal` lazy-loads `NewCastEditor` via the `next/dynamic` shim (`ssr:false`), so TipTap stays a client-only chunk; making it *work* (uploads, mentions, publish) is unit #8.
- **No auth flow.** `/login` here is a **placeholder** route (see Files) so the `AuthContext` logged-out client redirect has somewhere to land; the real login/onboarding surface is unit #9.
- **No worker `/api/*` data routes** (units #10/#11) — client fetches from the shell (sidebar feeds, notifications) 404 on the canary until then.
- **No new wallet wiring** — `WalletProviders` stays gated to its route list in `Providers` (unit #3), `NEXT_PUBLIC_ALCHEMY_API_KEY` stays a deferred #9 item (`strategy.md`).

## Audit (what the shell graph adds beyond unit #4, verified on `main`)

| # | Surface | Finding |
|---|---------|---------|
| A1 | `src/home/index.tsx` | All browser access (`localStorage` onboarding flag, `storage` listener) is inside `useEffect`; store reads are selector-based (H5-safe); `pathname === '/login'` early-return matches the Next behavior. Imports resolve via the #2 aliases. |
| A2 | `Sidebar/*` (`LeftSidebarNav`, `AccountSwitcher`, `AuthorContextPanel`, `feeds/*`) | SSR-safe: `useCollapsedSections` guards `typeof window` and reads storage in an effect; `AuthorContextPanel`'s module-scope `Number(process.env.NEXT_PUBLIC_APP_FID!)` is covered by the #4 `define` allowlist (`Number(undefined)` → NaN, no throw). |
| A3 | `CommandPalette/*` + `useRecentCommands` + `GlobalHotkeys` | `sessionStorage`/`localStorage` reads are effect- or `isClient`-guarded; the radix `Dialog` renders nothing while closed; `useGlobalHotkeys` needs `AppHotkeysProvider` — present in the #3 provider tree. CSS module (`CommandPalette.module.css`) bundles natively under vite. |
| A4 | `components/ui/sidebar.tsx` (`SidebarProvider`) + `use-mobile` | `document.cookie` write is callback-only; `useIsMobile` is `useState(undefined)` + effect — SSR-safe. |
| A5 | `NewCastModal` → editor chain | Already behind `next/dynamic` `ssr:false` → our shim renders nothing on the server and code-splits TipTap on the client. The chunk reads `NEXT_PUBLIC_CLOUDINARY_*` / `NEXT_PUBLIC_VERCEL_ENV` → **added to the `define` allowlist** (public values; reachable from the shell via the titlebar "Cast" action). |
| A6 | `AuthContext` redirect | Logged-out + `didLoad` on any path outside `/login`, `/profile*`, `/conversation*`, `/analytics*` → client `router.push('/login')`. Without a `/login` route the canary dead-ends in the default not-found → ship a placeholder route. |
| A7 | `useSocialGraphSync`, `useFarcasterProviderValue` | Effect-/hook-scoped; `getProviderType()` self-guards for SSR (`'neynar'`). Already proven importable by #4; first *mounted* here. |

## Files

- **New:** `docs/migration/phase-2-shell.md` (this file), `src/web/routes/_app.tsx` (pathless layout → `Home` shell), `src/web/routes/_app.shell-probe.tsx` (**throwaway** probe child at `/shell-probe`), `src/web/routes/login.tsx` (**placeholder** — replaced wholesale by unit #9), `src/web/lib/ssr-client-only-stub.tsx` (worker-bundle diet — see Gotchas).
- **Edit (migration-owned):** `src/web/routes/__root.tsx` (mount `GlobalHotkeys` + `CommandPalette` + `PerfPanel` inside `Providers`, mirroring `app/layout.tsx`), `vite.config.mts` (`define` += `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_VERCEL_ENV`; the `ssrClientOnlyStubPlugin`), `tsconfig.tanstack.json` (`include` += `src/common/types/global.d.ts` — the ambient `Window` augmentations shared components rely on are never imported, so they must be in the program; surfaced by the CastRow/linkify chain), `docs/migration/strategy.md` (status: #4 → ✅, #5 → 🔍), `docs/migration/conventions.md` (new seam row: the `_app` pathless layout).
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, **and every shared `src/` file** — this unit edits nothing outside `src/web/` + the migration-owned configs/docs.

## Route-tree topology (what later units build on)

```
__root.tsx            Providers + GlobalHotkeys + CommandPalette + PerfPanel   (= app/layout.tsx)
├── _app.tsx          pathless layout → <Home><Outlet/></Home>                 (= app/(app)/layout.tsx)
│   ├── _app.shell-probe.tsx   /shell-probe   (throwaway, this unit)
│   └── _app.<page>.tsx        /feeds /inbox …(units #6–#9, #12 add children here)
├── login.tsx         /login placeholder — outside _app, like app/(auth)/      (unit #9 replaces)
└── *-probe.tsx       earlier units' probes (root-level, no shell)
```

## Definition of Done / cf-canary (status as implemented)

- [x] `pnpm web:typecheck`, `pnpm web:build`, live `pnpm typecheck` all 0; `pnpm test` green (no shared-file edits → trivially).
- [x] `/shell-probe` **SSRs 200 on workerd with NO secrets configured** (`pnpm web:serve`, no `.dev.vars`/`.env.local`) — forkability bar. SSR HTML contains the desktop sidebar (`herocast` lockup, `LeftSidebarNav` items), the titlebar, and the `isHydrated=false` "Loading herocast" gate in the children slot — the same first paint the live Next app produces pre-hydration.
- [x] `/login` SSRs 200 (placeholder, no shell — `Home` early-returns children for `/login`, matching Next).
- [x] No import-time throw anywhere in the shell graph on workerd (the H6/H7 class); no `Rollup failed to resolve`. Earlier probes (`/stores-probe`, `/migration-probe`) still 200 — no regression.
- [x] Worker bundle **2289 KiB gzip < 3 MB** (`web:deploy:dry-run`) — the shell initially pushed it to **3152 KiB (over the limit)**; fixed by the `ssrClientOnlyStubPlugin` (see Gotchas), landing BELOW unit #4's 2433 KiB high-water mark.
- [x] Client bundle still contains no `NEYNAR_API_KEY` / `APP_MNENOMIC` name (grepped dist assets — #4 invariant holds after the new `define` keys).
- [ ] Browser (cf canary after deploy): cmd+k opens the command palette on any route (works logged-out — palette/hotkeys don't need store hydration); logged-out shell routes client-redirect to `/login`; with a session, `initializeStoresProgressive()` runs on mount (console phase logs), sidebar populates, palette navigation/channel commands act. *(Not verifiable in this sandbox — no browser.)*

## Gotchas (this unit)

- **The children slot SSRs as the hydration gate, not page content.** `Home` renders `Loading herocast` while `pageRequiresHydrate && !isHydrated`; `isHydrated` is always false on the server. That is the **correct** SSR output for shell routes (identical to the live app's pre-hydration paint) — do not "fix" it by hydrating stores during SSR. Page units that need SSR'd content (e.g. `/profile`) are exactly the paths excluded from `pageRequiresHydrate`.
- **Do not move `GlobalHotkeys`/`CommandPalette` under `_app`.** They must wrap every route (Next mounts them in the root layout); `useGlobalHotkeys` requires `AppHotkeysProvider` from the #3 provider tree, so they live inside `<Providers>` in `__root`.
- **`_app` filename = TanStack pathless-layout convention** (leading `_`). This is the one place the phase-1 "no leading underscore" probe rule inverts: probes must NOT have it, layouts MUST.
- **Sidebar data is store-fed, so the canary sidebar is mostly empty until login + the #10/#11 API ports** — the chrome itself (nav items, toggles, palette) is what this unit proves.
- **Bundle watch item (from #4) — resolved with a new mechanism.** A dynamic import is statically analyzable, so Rollup emits `ssr:false`-only chunks into the **worker** bundle even though the dynamic shim never invokes their loaders during SSR: `WalletProviders` dragged rainbowkit/wagmi + ~15 locale/OS chunks (~600 KiB gzip), `NewCastEditor` dragged TipTap (~280 KiB), and wagmi's walletconnect connector dynamically pulls `@walletconnect/ethereum-provider` (348 KiB) — total 3152 KiB, over the 3 MB Worker limit. Fix: `ssrClientOnlyStubPlugin` in `vite.config.mts` (CF build only) re-resolves those module specifiers to a **throwing stub** in the `ssr` environment; the client bundle keeps the real modules and code-splits as before. **Note:** a user-level `environments.ssr.resolve.alias` is silently dropped on merge (the CF plugin owns that env's config — verified via `resolveConfig`), hence a `resolveId` plugin scoped with `applyToEnvironment`. If a later unit needs one of these SSR-rendered, remove it from `ssrClientOnlyModules` and re-measure.
- The new `define` keys follow the unit-#4 rule: public values only, `VITE_X` preferred / `NEXT_PUBLIC_X` accepted, unset ⇒ literal `undefined`.

## Follow-ups surfaced (not fixed here)

- **[#6+] Sidebar links target un-ported routes** — each page unit lands its `_app.<page>.tsx` child; until then those links hit the default not-found. Consider a branded `notFoundComponent` on `__root` in a later unit if the gap lingers.
- **[#9] Replace `src/web/routes/login.tsx` placeholder** with the real auth surface (and the worker-side OAuth write, `phase-1.md §4.4`).
- **[#13] Delete `/shell-probe`** with the other probes at cutover.
