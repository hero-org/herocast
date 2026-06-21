# Unit #9 — auth + accounts + onboarding (OAuth write)

> Track B / epic #754. The **critical-path surface-tier unit**: it alone unblocks #11 (auth/onchain/WASM) → #12 → #13 (cutover). Mounts the real **authentication + accounts + onboarding** surface on the TanStack route tree and wires the worker's OWN OAuth `exchangeCodeForSession` **WRITE** end-to-end — the one path phase-1 proved only the READ half of (`phase-1.md §10`). Blocked-by: **#3 ✅** (provider tree — wallet/auth-context), **#5 ✅** (app shell). Template: `phase-1.md`. Reuse contract: `conventions.md`.

## Objective

Replace the unit-#5 `/login` placeholder with the real login surface, and port the accounts + onboarding pages onto the tree — **zero shared-component re-implementation**, reusing every shared component verbatim through the unit-#2 `next/*` vite aliases and the unit-#3 provider tree:

1. `/login` — the real login surface (`app/(auth)/login/page.tsx`): `UserAuthForm` (email/password + Google OAuth + reset), the logged-in redirect, the `signupOnly`/`view=reset`/`redirect` query handling. Outside the `_app` shell (like the current `routes/login.tsx`).
2. `/accounts` — the accounts management surface (`app/(app)/accounts/page.tsx`, ~497 LOC): connect-with-Warpcast (QR + signer polling), pay-with-ETH (onchain signer), drag-to-reorder accounts, manage/remove, read-only-upgrade card. Child of the `_app` shell.
3. `/welcome/new`, `/welcome/connect`, `/welcome/success` — the onboarding flow (`app/(auth)/welcome/*`): create-signer (CreateAccountPage), connect/poll (ConnectAccountPage), onboarding checklist (WelcomeSuccessPage). Outside the `_app` shell (the Next `(auth)` group has no app chrome).
4. `/auth/auth-code-error` — the OAuth-callback failure landing page (`app/auth/auth-code-error/page.tsx`). The 302 callback's error redirect target.
5. **The OAuth WRITE** — login THROUGH the worker via the EXISTING 302 callback route `src/web/routes/api/auth/callback.ts` (+ `supabase/server.server.ts` write client). No new auth-write path.

**The load-bearing decision (same as #5/#6): the page *logic* is ported into `src/web/pages/`, but every shared component it renders (`UserAuthForm`, `CreateAccountPage`, `QrCode`, `SwitchWalletButton`, `ConfirmOnchainSignerButton`, `AccountManagementModal`, the stores, the wagmi/rainbowkit providers) is consumed VERBATIM.** The only edits vs. the Next source are the same three surgical, SSR-mandated changes #6 codified (C1/C2/C3 below), plus one shared-file edit the migration deferred to this unit (the rainbowkit ALCHEMY key — strategy.md "Deferred").

## Non-goals

- **No new auth-write path.** The 302-redirect callback (`routes/api/auth/callback.ts`) + the `server.server.ts` write client already exist (phase-1). This unit **wires the round-trip**, it does not add or fork an auth-write seam. (`conventions.md` — "Write the Supabase session".)
- **No editor** (#8). `/welcome/success`'s "Schedule casts" pushes to `/post`; the email-signup flow pushes to `/post` — `/post` 404s on the canary until #8 lands. Ported intact; lights up for free when #8 ships.
- **No onchain/WASM** (#11). The pay-with-ETH path renders `ConfirmOnchainSignerButton` (wagmi `writeContract` to the Key Gateway). The wallet UI mounts client-only; the actual onchain account-creation flow (`/farcaster-signup`) is a **dangling link in the live Next app too** (no route exists — verified) and is #11's territory. Ported verbatim (the buttons exist, the route 404s exactly as on Next).
- **No `/settings`, `/lists`, `/channels`** (#12). The accounts read-only upgrade and `/welcome/success` link to them; they 404 on the canary until #12 — faithful to the live sidebar links.
- **No new wallet wiring.** `WALLET_ROUTES = ['/accounts', '/welcome/connect', '/settings']` already exists in the unit-#3 `Providers.tsx` — `/accounts` and `/welcome/connect` already get `WalletProviders` (dynamic `ssr:false`, client-only). No `Providers.tsx` edit.

## The surgical changes vs. the Next source (everything else is byte-identical)

| # | Next source | Ported `src/web` form | Why |
|---|-------------|------------------------|-----|
| C1 | `import { … } from 'next/navigation'` / `'next/link'` | `import { … } from '@/web/lib/navigation'` / `'@/web/components/link'` | New `src/web` code imports the unit-#2 adapters **directly** (per `conventions.md` / unit #6 C1), not via the build-alias indirection. Same runtime behavior. |
| C2 | module-scope / render-scope `createClient()` | n/a here — **no change needed** | The accounts page reads `Number(process.env.NEXT_PUBLIC_APP_FID!)` at module scope (allowlisted #4; `Number(undefined)`→NaN, no throw). The only `createClient()` is **inside the shared `UserAuthForm`** at render scope — and login SSRs the `!didLoad` spinner, so `UserAuthForm` (and its `createClient()`) **never render during SSR**. No deferral edit required. (Documented so a reviewer doesn't "add" one.) |
| C3 | `'use client'` directive | removed | Inert under TanStack. Dropped as noise. |

## The one shared-file edit — the rainbowkit ALCHEMY key (strategy.md "Deferred")

`src/common/helpers/rainbowkit.tsx:9` reads `process.env.NEXT_PUBLIC_ALCHEMY_API_KEY` at **module scope** → `undefined` under Vite (Vite does NOT inline `NEXT_PUBLIC_*`), so wagmi transports resolve to `…/v2/undefined` (the modal opens but every RPC fails). Fix host-agnostic, keeping the **Next build green**:

```ts
const alchemyApiKey =
  (import.meta as any).env?.VITE_ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
```

- **Vite (this build):** inlines `import.meta.env.VITE_ALCHEMY_API_KEY` → real key → working RPC.
- **Next/webpack (live app):** `import.meta.env` is `undefined` there; `?.` short-circuits → falls back to `process.env.NEXT_PUBLIC_ALCHEMY_API_KEY`, which `next build` inlines. **The `?.` is load-bearing** — a bare `import.meta.env.X` would throw `TypeError: cannot read properties of undefined` at module load in the Next bundle.
- **`(import.meta as any)`** keeps the live `pnpm typecheck` (root tsconfig has no `vite/client` types, so `import.meta.env` would otherwise be a type error) green.
- Add `VITE_ALCHEMY_API_KEY` to `.env.local.example` **and** a `define`-allowlist entry in `vite.config.mts` (public value; `VITE_X` preferred / `NEXT_PUBLIC_X` accepted; **never a secret**). Same class as the unit-#3 PostHog `VITE_*` fix.

This is the ONLY permitted shared-file edit (`conventions.md` "Do NOT … touch a shared file you weren't assigned" is waived for exactly this one, per the kickoff).

## Route-tree topology (children added)

```
__root.tsx                     Providers + GlobalHotkeys + CommandPalette + PerfPanel
├── _app.tsx                   <Home><Outlet/></Home>                    (unit #5)
│   ├── _app.shell-probe.tsx   /shell-probe                              (unit #5)
│   ├── _app.feeds.tsx         /feeds                                    (unit #6)
│   ├── _app.profile.*.tsx     /profile, /profile/$slug                  (unit #6)
│   └── _app.accounts.tsx      /accounts            ← this unit (inside the shell)
├── login.tsx                  /login               ← this unit (REPLACES the #5 placeholder)
├── welcome.new.tsx            /welcome/new         ← this unit (outside _app)
├── welcome.connect.tsx        /welcome/connect     ← this unit (outside _app)
├── welcome.success.tsx        /welcome/success     ← this unit (outside _app)
├── auth.auth-code-error.tsx   /auth/auth-code-error ← this unit (outside _app)
└── api/auth/callback.ts       /api/auth/callback   (phase-1; the OAuth WRITE — unchanged)
```

`/accounts` is in the Next `(app)` group → gets the `Home` shell → `_app.accounts.tsx`. `/login` and `/welcome/*` are in the Next `(auth)` group (a centered layout, no chrome) and `/auth/auth-code-error` is a standalone path (root layout only) → all **outside `_app`**. The `/welcome/*` pages mount under a pathless `_auth` layout route (`src/web/routes/_auth.tsx` = the faithful port of `app/(auth)/layout.tsx`'s `min-h-screen flex items-center justify-center` wrapper). `/login` keeps its standalone `routes/login.tsx` (per the kickoff) and self-centers (`LoginContent` carries its own `min-h-screen`), so it renders identically without the `_auth` wrapper; `/auth/auth-code-error` self-centers too.

## SSR render analysis (which pages render server-side — drives the bundle stub decision)

The provider tree (`Providers.tsx`, unit #3) gates wallet routes behind `WalletProviders` = `dynamic(ssr:false)` → renders `null` during SSR. The `Home` shell gates `pageRequiresHydrate` routes behind the `isHydrated=false` "Loading herocast" gate during SSR. So:

| Route | In `_app`? | Wallet route? | SSR renders the page body? |
|-------|-----------|---------------|----------------------------|
| `/login` | no | no | **no** — `LoginContent` returns the `!didLoad` spinner; `UserAuthForm` never mounts server-side |
| `/accounts` | yes | **yes** | **no** — `Home` renders the hydrate gate (pageRequiresHydrate) AND `WalletProviders` is null on SSR |
| `/welcome/new` | no | no | **no (by design)** — `CreateAccountPage` → `warpcastLogin` → `@farcaster/hub-web` factory can't run during workerd SSR (G1), so it's mounted `dynamic(ssr:false)`; SSRs the centered `_auth` layout + null, content paints client-side |
| `/welcome/connect` | no | **yes** | **no** — `WalletProviders` null on SSR gates the whole subtree (and `WelcomeConnectPage` is `ssrClientOnlyModules`-stubbed, G1) |
| `/welcome/success` | no | no | **yes** — SSRs the onboarding card (accounts `[]` pre-hydrate → connected-account block skipped) |
| `/auth/auth-code-error` | no | no | **yes** — pure static page |

**Consequence:** the wallet-dependent leaves (`SwitchWalletButton`, `ConfirmOnchainSignerButton` — both statically `import … from '@rainbow-me/rainbowkit'`) are imported ONLY by `/accounts` + `/welcome/connect`, and **neither renders during SSR**. So they are safe to stub in the workerd (`ssr`) env if they push the worker bundle over the 3 MB limit (the stub throws only when rendered, which never happens server-side).

## Files

- **New (this spec):** `docs/migration/phase-2-auth-accounts.md`.
- **New (page logic, ported):** `src/web/pages/LoginPage.tsx`, `src/web/pages/AccountsPage.tsx`, `src/web/pages/WelcomeConnectPage.tsx`, `src/web/pages/WelcomeSuccessPage.tsx`, `src/web/pages/WelcomeNewPage.tsx` (client-only `dynamic(ssr:false)` wrapper of the shared `CreateAccountPage` — see G1), `src/web/pages/AuthCodeErrorPage.tsx`.
- **New (thin routes):** `src/web/routes/_app.accounts.tsx`, `src/web/routes/_auth.tsx` (pathless layout = port of `app/(auth)/layout.tsx`), `src/web/routes/_auth.welcome.new.tsx`, `src/web/routes/_auth.welcome.connect.tsx`, `src/web/routes/_auth.welcome.success.tsx`, `src/web/routes/auth.auth-code-error.tsx`. (The `_auth` pathless layout adds no URL segment; `/welcome/*` resolve as expected — verified in `routeTree.gen.ts`. `/login` keeps its standalone `routes/login.tsx` per the kickoff and self-centers.)
- **Replace wholesale:** `src/web/routes/login.tsx` (the unit-#5 placeholder → the real login route mounting `LoginPage`).
- **Edit (the one shared file):** `src/common/helpers/rainbowkit.tsx` (the ALCHEMY host-agnostic read — above).
- **Edit (migration-owned):** `vite.config.mts` (`define` += `NEXT_PUBLIC_ALCHEMY_API_KEY`; **`ssrClientOnlyModules` += `AccountsPage|WelcomeConnectPage`** — the G1 init-crash fix), `.env.local.example` (`VITE_ALCHEMY_API_KEY=`), `docs/migration/strategy.md` (status: #6 → ✅; #9 → 🔍 + PR ref; clear the rainbowkit deferred follow-up). (No `conventions.md` edit — this unit reuses every seam unchanged and introduces none; the auth-write callback row is already accurate. The OAuth WRITE round-trip is wired but only fully provable with real Supabase secrets + a configured provider — see the canary DoD.)
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, and **every shared `src/` file except `rainbowkit.tsx`**.

## Reuse contract (per `conventions.md`)

- **Navigation:** `@/web/lib/navigation` (`useRouter`/`useSearchParams`) + `@/web/components/link` — imported directly in new code (C1).
- **Shell mount:** `/accounts` is a child of `_app` (unit #5); auth/onboarding pages sit outside `_app` (like `routes/login.tsx`).
- **Auth READ:** `getUserFn` / the `server.server.ts` read client — unchanged.
- **Auth WRITE:** the **302-redirect callback** `routes/api/auth/callback.ts` + `server.server.ts` write client — unchanged. **`setCookie` survives only on the non-2xx (302) response** (R2). Do NOT convert to a 200 JSON auth-write.
- **Supabase (browser):** `getSupabaseClient()`/`createClient()` lazy singleton — reused inside `UserAuthForm`/`AuthContext` verbatim; never called at module scope in ported code.
- **Wallet:** the unit-#3 route-scoped `WalletProviders`; `config`/`rainbowKitTheme` from `@/common/helpers/rainbowkit` (the ALCHEMY-fixed shared file).
- **`define` allowlist:** ported pages read only `NEXT_PUBLIC_APP_FID` at module scope (allowlisted #4). The new public key is `NEXT_PUBLIC_ALCHEMY_API_KEY`/`VITE_ALCHEMY_API_KEY` (added here).
- **Bundle diet:** extend the existing `ssrClientOnlyStubPlugin` regex if needed — do NOT fork a new stub mechanism.

## Gotchas (this unit)

- **G1 (load-bearing) — the `@farcaster/hub-web` module-scope factory crashes worker INIT.** This was the single hardest issue in the unit; the fix is two-pronged.
  - **Symptom:** with the auth/accounts pages mounted, EVERY route 500s at worker init with `Error: Disallowed operation called within global scope … generating random values` — including `/api/health` and the unrelated probes. The stack bottoms out in `@farcaster/hub-web`'s `Factory.build()` → `@noble/hashes` `randomBytes` (`crypto.getRandomValues`), which hub-web's single-file bundle runs **at module top-level** to define its test factories. workerd forbids random-gen in global scope.
  - **Why it appeared now (not in #6):** hub-web's factory is pulled by `warpcastLogin` (`NobleEd25519Signer`), `AccountManagement`'s `Change*Form` (`UserDataType`), and `getProvider`. When only a SSR-**gated** route (feeds — hydrate gate) or a lazily-chunked component (`CreateAccountPage`) imports it, the factory lives in a **lazy chunk** that's never loaded during SSR, so it only ever runs in the browser (random-gen is fine there). The auth/accounts routes are the first **eager, ungated** importers, so Rollup HOISTED the factory module into the eager worker-entry (`router`) chunk → it ran at init → universal 500. `moduleSideEffects:false` can NOT drop it (the factory vars are transitively *referenced* by used hub-web exports), so tree-shaking is not the lever.
  - **Fix part A — stub the two client-only ROUTE PAGES.** `/accounts` (Home hydrate gate) and `/welcome/connect` (WalletProviders null-on-SSR) never render their body during SSR, so `AccountsPage` and `WelcomeConnectPage` are added to `ssrClientOnlyModules` (`vite.config.mts`). This drops their ENTIRE client-only graph (wallet stack + hub-web factory) out of the worker, so the factory is no longer shared into the eager chunk. This **supersedes** stubbing the individual wallet leaves (`SwitchWalletButton`/`ConfirmOnchainSignerButton`) — they're only reachable via these two pages.
  - **Fix part B — `/welcome/new` mounts `CreateAccountPage` via `dynamic(ssr:false)`** (`src/web/pages/WelcomeNewPage.tsx`). Unlike /accounts and /welcome/connect, /welcome/new is NOT SSR-gated, so it WOULD render `CreateAccountPage` during SSR — loading the factory chunk and throwing (caught → 200 but empty body). The `next/dynamic` shim with `ssr:false` never invokes the loader on the server, so the chunk is never imported during SSR and the factory never runs there; the real component mounts after hydration (account-creation/keygen is inherently client-side anyway).
  - **Verified:** all routes SSR **200 with zero `Disallowed operation` throws** (`/welcome/new` throw count went 1 → 0), `/feeds`/`/shell-probe` unregressed. Worker bundle **2317.73 KiB gzip** (+24 KiB over unit #6's 2293.75 KiB; the page stubs keep the heavy accounts graph out of the worker). The `define`-pinned ALCHEMY key adds no client leak (public value, like live Next).
- **G2 — the OAuth WRITE is the de-risk target (phase-1 §10).** The callback returns **302**; TanStack merges `Set-Cookie` onto a handler Response ONLY when non-2xx, so the chunked `sb-<ref>-auth-token.0/.1` cookies survive. The `next` redirect param is hardened (single leading `/`, reject `//`); `X-Forwarded-Host` is dropped (no trusted LB on a bare Worker); `@supabase/ssr`'s own `parseCookieHeader` is used (single decode). **All already implemented in `callback.ts` + `server.server.ts` (phase-1).** This unit's job: prove the round-trip (login through the worker → callback 302 sets cookies → a later request's `getUserFn` returns a real UUID → a logged-in page renders).
- **G3 — login SSRs the spinner, not the form.** `LoginContent` returns the `!didLoad` loading state on the server; `UserAuthForm` (with its render-scope `createClient()`) only mounts after the client `AuthProvider` effect sets `didLoad`. This is the forkability-safe path (login SSRs 200 with no secrets). Do NOT "fix" it by rendering the form during SSR.
- **G4 — the AuthContext logged-out redirect bounces non-excluded routes to `/login`.** `/accounts`, `/welcome/*`, and `/auth/auth-code-error` are NOT in the AuthContext exclusion list (`/login`, `/profile`, `/conversation`, `/analytics`), so a logged-out visitor is client-redirected to `/login` after `didLoad`. This is verbatim live-app behavior — preserved, not changed.
- **G5 — route-tree typecheck is generated.** New routes fail `pnpm web:typecheck` (`'/accounts' not assignable to keyof FileRoutesByPath`) until `vite build` regenerates `routeTree.gen.ts`. **Build once, then typecheck** (same as #6/#10).
- **G6 — `/farcaster-signup` is a dangling link in the live app.** The accounts page's "Create new account" buttons `router.push('/farcaster-signup')` — no such route exists in `app/` or `pages/` (verified). Ported verbatim; it 404s on the canary exactly as on live Next. Out of scope (the onchain signup surface is #11/#12).

## Definition of Done / cf-canary

- [x] `pnpm web:build` 0, `pnpm web:typecheck` 0 (after a build regenerates `routeTree.gen.ts`), live `pnpm typecheck` 0 (the rainbowkit edit is shared), `pnpm test` all passing.
- [x] Routes generated: `/accounts`, `/login`, `/welcome/new`, `/welcome/connect`, `/welcome/success`, `/auth/auth-code-error` (verified in `routeTree.gen.ts` — pathless `_auth` resolves to `/welcome/*`).
- [x] **Worker bundle < 3 MB gzip** (`web:deploy:dry-run`) — **2317.73 KiB gzip** (+24 KiB over unit #6's 2293.75 KiB; the G1 page stubs keep the heavy accounts/wallet graph out of the worker).
- [x] **No secret VALUE in the client bundle** — `NEYNAR_API_KEY` name absent from `dist/client`; secrets `define`-pinned to `undefined`. `NEXT_PUBLIC_ALCHEMY_API_KEY` is a public key (client-exposed by design, same as on live Next; only inlined when `VITE_ALCHEMY_API_KEY`/`.env.local` is set at build).
- [x] `/login` and `/accounts` SSR **200 on workerd with NO secrets** (`pnpm web:serve`, `.dev.vars` moved aside) — forkability bar. All six new routes + `/api/health` SSR 200 with zero `Disallowed operation` throws, with and without secrets.
- [ ] **OAuth WRITE round-trip (needs real secrets + an OAuth provider):** with `SUPABASE_URL`/`SUPABASE_ANON_KEY` in `.dev.vars` (+ `VITE_SUPABASE_*` in `.env.local`) and a configured provider, log in THROUGH the worker — the callback 302 sets the chunked `sb-*` cookies, a subsequent request's `getUserFn` returns a real Supabase UUID, and a logged-in page renders. *(Canary prerequisite: without real Supabase secrets + a provider the shell still SSRs 200 (forkability bar) but the login round-trip cannot complete — note in the canary log.)*
- [ ] **Wallet modal opens AND a wallet RPC call succeeds** on `/accounts` (the ALCHEMY fix is what makes RPC work, not just the modal opening).
- [ ] The dev Neynar key may be over monthly quota (HTTP 402): any feed/profile data on logged-in pages returns the quota error (correct passthrough) — render empty/loading gracefully; treat 402 as "needs a quota'd key", not a bug.

## Review + ship

- **Tier-1:** `/code-review` on the diff (+ an adversarial multi-dimension review workflow) until clean. (Tier-2 codex integration review runs at the surface-tier boundary AFTER #6–#9 all land — NOT in this unit.)
- Update strategy.md (#9 → 🔍 + PR ref; #6 → ✅; clear the rainbowkit deferred item). Open a PR to `main` (`feat(#754 auth-accounts): unit #9 — auth + accounts + onboarding on TanStack`). Do NOT merge.
</content>
</invoke>
