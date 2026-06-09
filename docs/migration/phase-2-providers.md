# Unit #3 — provider tree (wallet, posthog, persist-query, auth, hotkeys)

> Track B / epic #754. Next link in the foundation chain (`#3 → #4 → #5`). **Highest-risk port** — every interactive surface depends on it, and wagmi/rainbowkit/auth-kit/posthog/IDB-persister under React 19 + workerd SSR are unproven. Blocked-by: **#2 ✅** (this unit relies on the nav adapter). Template: `phase-1.md`. Protocol + reuse contract: `conventions.md`.

## Objective

Port `app/providers.tsx` onto the Phase-1 `src/web/providers/Providers.tsx` (Theme + Query only today), adding the deferred providers, **SSR-safe on workerd + React 19**, with zero live-app edits. Shared `src/` providers are reused via the #2 build aliases; app-only pieces (`app/WalletProviders.tsx`) are ported into `src/web`.

## The target tree (from `app/providers.tsx`, outer → inner)

```
ThemeProvider (next-themes)                         ← already in Phase-1 ✅
  └ PostHogProvider (if posthog)                    ← client-only analytics
      └ PersistQueryClientProvider (+ IDB persister, provider-scoped buster)
          └ [WalletProviders if needsWallet route]  ← wagmi/rainbowkit, dynamic ssr:false
              └ AuthProvider                         ← shared src/common (uses next/navigation → #2 adapter)
                  └ AppHotkeysProvider               ← shared src/common
                      └ NavigationPerfTracker + WebVitalsTracker + children
```
Plus side effects: posthog `$pageview` on pathname change; `@farcaster/frame-sdk` `ready()` on mount. `needsWallet = ['/accounts','/welcome/connect','/settings'].some(r => pathname?.startsWith(r))`.

## Approach
- **Reuse, don't fork** shared `src/` code via the #2 aliases: `AuthProvider` (`@/common/context/AuthContext`, uses `usePathname`/`useRouter` → our adapter ✅), `AppHotkeysProvider`, `next-themes` `ThemeProvider`, the **already-`window`-guarded** IDB persister (`@/lib/queryPersister`: `createIDBPersister`/busters/`shouldPersistQuery`), and the wagmi config (`@/common/helpers/rainbowkit`).
- **Port app-only pieces** into `src/web`: the `WalletProviders` wrapper (14L over the shared rainbowkit config).
- **Reconcile one query client:** use the Phase-1 `@/web/lib/queryClient` (`getQueryClient`) and wrap it with `PersistQueryClientProvider` + the reused persister (replaces the plain `QueryClientProvider`).

## SSR / React-19 landmines (the reason this is L/high-risk — handle explicitly)

1. **localStorage in a `useState` initializer.** `useState(() => getProviderType())` (provider-scoped buster) runs **during SSR render** on workerd, where `localStorage` doesn't exist → throws. Guard: `typeof window === 'undefined'` fallback to a default buster on the server.
2. **PostHog env var.** `loadPosthogAnalytics` reads `process.env.NEXT_PUBLIC_POSTHOG_KEY` — **undefined in the Vite client build**. Source the key from `import.meta.env.VITE_POSTHOG_KEY` (add to `.env.local.example`); keep the `typeof window` guard. No key ⇒ no-op (forkable).
3. **Wallet must be `dynamic(ssr:false)`.** wagmi/rainbowkit can't render on workerd; use the #2 `next/dynamic` shim (ssr:false ⇒ client-only mount-after-hydration) and keep it **route-scoped** (`needsWallet`) so non-wallet routes never load it.
4. **PersistQueryClientProvider** renders children immediately and restores async on the client — SSR-safe; just don't read IDB during render. **Devtools** stay `import.meta.env.DEV`-gated (Phase-1 pattern).
5. **`frame-sdk ready()`** is a client `useEffect` — fine; dynamic-import it so it isn't in the server graph.

## Parallel areas (disjoint — see `conventions.md` → Agent execution protocol; log to `.context/03-providers/<area>.md`)

- **Area A — provider tree assembly.** `src/web/providers/Providers.tsx`: build the full nesting above, reusing shared providers (Auth/Hotkeys/Theme) + the perf/vitals trackers + the frame-sdk-ready effect + the `needsWallet` route-scoping (import `usePathname` from `@/web/lib/navigation`). Compose Area B's `WalletProviders` (route-scoped) and Area C's persist/posthog/queryClient wiring. **Guard landmine #1.** Owns `Providers.tsx`.
- **Area B — wallet stack.** `src/web/providers/WalletProviders.tsx`: port the 14L `app/WalletProviders.tsx` wrapper (`WagmiProvider` + `RainbowKitProvider` + the `@rainbow-me/rainbowkit/styles.css` import), reusing `config`/`rainbowKitTheme` from `@/common/helpers/rainbowkit` (shared, via alias). Verify it mounts client-only under React 19 (it's loaded via Area A's `dynamic(ssr:false)`). Owns `WalletProviders.tsx`.
- **Area C — persistence + analytics plumbing.** Wire the reused IDB persister (`@/lib/queryPersister`) + the Phase-1 `@/web/lib/queryClient` into a small helper Area A consumes (or export the persistOptions); fix PostHog to read `import.meta.env.VITE_POSTHOG_KEY` (landmine #2) in a `src/web` analytics shim; add `VITE_POSTHOG_KEY=` to `.env.local.example`. Add `src/web/routes/providers-probe.tsx` exercising the mounted tree (theme toggle, a persisted query, posthog presence). Owns the analytics shim + persist wiring + the probe.

> Ownership: A owns `Providers.tsx`; B owns `WalletProviders.tsx`; C owns the analytics shim + persist helper + probe + `.env.local.example`. None edits another's files or the live app.

## Definition of Done / cf-canary
- [ ] `pnpm web:build` + `web:typecheck` green; live `pnpm typecheck` still 0; zero live-app files touched.
- [ ] `cf.herocast.xyz` shell mounts the full provider tree with **no hydration warnings** and **no SSR throw** (localStorage/IDB guarded on workerd).
- [ ] Theme toggle works + persists; PostHog initializes when `VITE_POSTHOG_KEY` is set (no-ops otherwise); a React Query result persists to IDB and restores on reload.
- [ ] On a `needsWallet` route, the wallet-connect modal opens (wagmi/rainbowkit mount client-only); non-wallet routes don't load the wallet bundle.
- [ ] Bundle still < 3 MB gzip (wallet chunk lazy/route-scoped, not in the main bundle).

## Gotchas (from `conventions.md` + this unit)
- `process.env.NEXT_PUBLIC_*` is NOT inlined by Vite — use `import.meta.env.VITE_*` for client config.
- `useState` initializers run during SSR — guard any `localStorage`/`window` read.
- WalletProviders MUST be `dynamic(ssr:false)` and route-scoped; never in the server graph.
- Reuse the `window`-guarded `@/lib/queryPersister` as-is; don't reinvent it.
- `import type` for types; the #2 nav adapter backs `usePathname`/`useRouter`/`next/dynamic`.

## Execution
Fan out **A, B, C** to parallel agents in one workspace (branch `migration/03-providers` off latest `main` after #2 merges), then the **integrator** builds, runs `/code-review` + a Codex pass, commits (`feat(#754 providers): …`), and flips #3 → ✅ in `strategy.md`. Prompts are generated per the `conventions.md` protocol (same shape as unit #2).
