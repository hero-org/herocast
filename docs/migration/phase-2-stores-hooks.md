# Unit #4 — stores + RQ hooks SSR-safety pass

> Track B / epic #754. Foundation chain `#3 ✅ → #4 → #5`. Makes the **shared** state layer — the 14 Zustand stores (`src/stores/`) and the React Query hooks (`src/hooks/queries/`) — importable and render-safe under workerd SSR + the Vite client build, so unit #5 (app shell + sidebar) can consume them as-is. Blocked-by: **#3 ✅**. Template: `phase-1.md`. Reuse contract: `conventions.md`.

## Objective

Every store/hook module the app shell needs must (a) **import** without throwing on workerd (module scope runs during SSR) and in the Vite client bundle (where `NEXT_PUBLIC_*` is not inlined and `window` rules differ), and (b) **render** via `useStore(selector)` / `useQuery` during SSR without touching browser globals. Proven by a new SSR probe route that imports the entire store + query-hook surface.

## Non-goals

- **No data fetching on the server** — RQ hooks fetch client-side only (no suspense/prefetch here; loaders come with the page ports, units #5–#7).
- **No store hydration on the server** — `initializeStores*` stays a client-mount concern (unit #5 wires it).
- **No porting of `/api/*` endpoints** the hooks call (units #10/#11). On the worker the hooks' client-side fetches 404 until then — the probe only proves render-safety, not data.
- **No behavior change for the live Next app** — shared-file edits must be timing-only (lazy init), never semantic.

## Audit findings (what actually breaks, verified on `main`)

| # | Hazard | Where | Class |
|---|--------|-------|-------|
| H1 | **Module-scope `createClient()`** — throws when `NEXT_PUBLIC_SUPABASE_*` is absent (always, in the Vite client bundle; and on workerd unless inlined). Breaks *import*, not just use. | `useDraftStore.ts:273`, `useListStore.ts:81`, `useNotificationStore.ts:21`, `useUserStore.ts:27` | fix (lazy) |
| H2 | **`process.env.NEXT_PUBLIC_*` reads are not inlined by Vite** — resolve `undefined` (Supabase URL/key, APP_FID, HYPERSNAP_URL, ENABLE_SPACES, URL). | `supabase/component.ts`, `useAccountStore.ts:25`, `hypersnap.ts:34`, `constants/spaces.ts:11`, `useSocialGraphSync.ts:7` | fix (vite `define`) |
| H3 | Module-scope `window`/`document` listeners | `useNotificationStore`, `useWorkspaceStore`, `usePerformanceStore` | already `typeof window` guarded ✅ |
| H4 | `persist` storage: IndexedDB wrapper + `sessionStorage` getter | `StoreStorage.ts`, `useDraftStore.ts:821` | already safe (ctor guard; zustand v4 `createJSONStorage` try/catches) ✅ |
| H5 | zustand render path during SSR | all stores | safe — v4 `useSyncExternalStore` with `getState` server snapshot ✅ |
| H6 | **`@farcaster/core` runs `Factory.build()` → `randomBytes` at module scope** inside its bundled test factories (`MessageDataFactory.params({ verificationRemoveBody: VerificationRemoveBodyFactory.build(…) })`) — workerd forbids random generation in global scope; killed SSR of any route whose graph touches the package. *(Found empirically on workerd — invisible to `vite build`.)* | `@farcaster/core/dist/index.mjs` (via `useDraftStore` → `helpers/farcaster`) | fix (rollup `treeshake.moduleSideEffects` declares the module side-effect-free; nothing imports `Factories`, so the whole chain tree-shakes out — server route chunk also shrank 1108→792 kB) |
| H7 | **`useWorkspaceStore` seeded `initialState.layout` with `crypto.randomUUID()` at module scope** — same workerd global-scope restriction, plus a latent SSR/client hydration mismatch (server and client generated different default panel ids). *(Found empirically after H6 was fixed.)* | `useWorkspaceStore.ts:30` | fix (fixed `DEFAULT_PANEL_ID` sentinel for the default panel; runtime `addPanel` still uses random UUIDs; persisted layouts replace the default wholesale) |

**Fix strategy (seam-conformant):**

1. **Lazy Supabase client (shared-file edit, timing-only):** a new shared `getSupabaseClient()` in `src/common/helpers/supabase/component.ts` (lazy + singleton — `createClient()` already caches internally); the four stores import it instead of creating clients at module scope. *(Tier-1 review outcome: extracted to ONE helper rather than copying the per-store getter pattern a 4th–7th time; `useWorkspaceStore`/`useAccountStore`/`userPreferencesSync` keep their pre-existing local getters — converging them is cheap follow-up churn, not unit scope.)* Next app behavior is identical (singleton, created on first use instead of at import). Required regardless of env inlining: the **forkability bar** says the probe must render with **no secrets present**.
2. **Vite `define` for public `NEXT_PUBLIC_*` config (`vite.config.mts` only):** inline the *public* keys at build time from `.env.local` (`VITE_X` preferred, `NEXT_PUBLIC_X` accepted so the Next app's existing `.env.local` works unchanged). **Explicitly pinned to `undefined`: `NEXT_PUBLIC_NEYNAR_API_KEY` and `NEXT_PUBLIC_APP_MNENOMIC`** — never inline secrets into the client bundle (#751; the TanStack path keeps Neynar server-side).
   *Why `define` and not editing `component.ts` to read `import.meta.env`:* Jest is ts-jest/CJS — `import.meta` in a shared file is a syntax error in the test graph; `define` needs zero shared-file edits.

## Files

- **New:** `docs/migration/phase-2-stores-hooks.md` (this file), `src/web/routes/stores-probe.tsx`.
- **Edit (migration-owned):** `vite.config.mts` (define block + `@farcaster/core` treeshake rule), `docs/migration/strategy.md` (status), `docs/migration/conventions.md` (two new seam rows: `getSupabaseClient`, the `NEXT_PUBLIC_*` define allowlist).
- **Edit (shared, timing-only):** `src/common/helpers/supabase/component.ts` (adds `getSupabaseClient()`), `src/stores/useDraftStore.ts`, `useListStore.ts`, `useNotificationStore.ts`, `useUserStore.ts` (module-scope client → shared lazy getter), `src/stores/useWorkspaceStore.ts` (H7 fixed default-panel id).
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, all other shared files.

## The probe — `/stores-probe` (SSR route)

Imports **all 14 store modules** (incl. `initializeStores`) + **all 14 query-hook modules**, then:
- SSR-renders a selector read from every store (`useXxxStore(s => …)`) — proves the `useSyncExternalStore` server path end-to-end.
- Mounts one real RQ hook (`useTrendingFeed`, small limit) — SSR renders its pending state; on the client it fetches `/api/feeds/trending` (404 on the worker until unit #10 — the probe renders the error state gracefully and says so).
- Client-mount effect flips a "client stores OK" flag after exercising a `getState()` read+write round-trip — distinguishes SSR output from hydrated output.
- Renders an evidence panel: store selector snapshot, RQ status, hydration flag.

Like `migration-probe`, it is **throwaway** — deleted at cutover (#13).

## Definition of Done / cf-canary (status as implemented)

- [x] `pnpm web:typecheck`, `pnpm web:build`, live `pnpm typecheck` all 0; jest 150/150 green.
- [x] `/stores-probe` SSR-renders **200 on workerd with no secrets** (`pnpm web:serve`, no `.dev.vars`/`.env.local`) — forkability bar. All 12 store selectors render real values in the SSR HTML; no React error boundary; `useTrendingFeed` renders `pending`.
- [x] All store/hook modules in the route graph — no `Rollup failed to resolve`, no import-time throw on workerd (H6/H7 were exactly this class, found and fixed).
- [x] Client bundle contains **no** `NEYNAR_API_KEY` / `APP_MNENOMIC` name or value (grepped dist assets).
- [x] Worker bundle **2433 KiB gzip < 3 MB** (`web:deploy:dry-run`) — ⚠️ **watch item**: up from 578 KiB; the probe drags the full store/hook surface (rainbowkit, livekit, farcaster chains) into the worker. Expected to be the high-water mark until real routes replace the probe; revisit at unit #5.
- [ ] Hydration: evidence panel flips to "client stores OK" in a real browser. *(Not verifiable in this sandbox — no browser. Check on the cf canary after deploy; SSR output is proven, and the round-trip is a `getState()` toggle that jest-covered stores exercise.)*

## Gotchas (this unit)

- `define` values must be emitted as the literal `undefined` (not the string `"undefined"`) when unset, so existing `!url` guards behave.
- `define` applies to **both** the client and workerd bundles — fine for public config, which is why secrets are pinned out explicitly.
- The probe must NOT call `initializeStores()` during SSR (hydration is client-only by design); importing it is the test.
- `useDraftStore`'s draft chain pulls `@farcaster/core` → the faker alias (`vite.config.mts`) is what keeps the bundle sane; do not remove.
- Stores write to the **shared** `@/lib/queryClient` singleton — same instance the #3 provider tree serves; no second client.

## Follow-ups surfaced (not fixed here)

- `useWorkspaceStore` / `useAccountStore` / `userPreferencesSync` still carry their pre-existing local lazy-getter copies — converge them onto the shared `getSupabaseClient()` in a later cleanup pass (pure churn, zero behavior change).

- The worker has no `/api/*` data endpoints yet, so client-side hook fetches 404 on the canary until units #10/#11 — expected, visible in the probe.
- `useSocialGraphSync.ts` (non-query hook) and other `src/hooks/*` outside `queries/` get the same `define` coverage but are exercised by unit #5's shell, not this probe.
