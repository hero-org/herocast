# Desktop consumer — Deno desktop runtime

> Resolves the open question parked in `phase-1.md §10` ("the desktop build currently targets the
> Next app; how it consumes the TanStack app must be resolved before Phase 4 cutover"). **Decision
> is made; execution is deferred until after #13 cutover.** The old **Tauri integration has been
> removed** from the repo — it was already dormant (no `src-tauri/`, no Tauri deps, dead/commented
> CI, stale `rls` scripts that no longer existed).

## Decision

Ship the desktop app as the **same TanStack Start app**, wrapped by the
[Deno desktop runtime](https://docs.deno.com/runtime/desktop/). The desktop binary *is* the
migrated app — no separate "consumer" shim.

- **Rendering backend: `cef`** (bundled Chromium). It gives identical rendering across OSes + full
  web-platform support + DevTools, which is what herocast's heavy UI needs (TipTap editor, HLS
  video embeds, wallet popups).
- **Binary size is explicitly NOT a priority right now.** Deno desktop also has a native `webview`
  backend (much smaller binaries) — that's a *later optimization*, not a blocker, and only worth it
  if it renders our UI cleanly across platforms.

## Why Deno desktop

- **It auto-detects & runs TanStack Start natively** — the desktop app is literally our web app, no
  glue layer.
- **One TypeScript codebase, one toolchain** — no second language/build system to maintain.
- **It reuses our host-portability seam.** `vite.config.mts` already emits a universal `fetch`
  server entry where the host is a build-plugin swap (`TARGET=cloudflare` / `vercel`). Deno is just
  another target.
- **Selectable rendering backend** — `cef` now for fidelity; `webview` later if we ever want small
  binaries, from the same codebase.

## What the spike already proved ✅

(Full run notes: `scripts/spikes/deno-desktop/`. Verified on macOS arm64 + a Linux sandbox, 2026-06-23.)

- **Host seams fall through on Deno with zero new code.** `serverEnv()` → `process.env`;
  `getCacheBackend()` → in-process memory backend. Only the `cloudflare:workers` *import* needs
  aliasing, which the existing `TARGET=vercel` branch already does → Deno is a build-target swap,
  not a rewrite.
- **`deno desktop` builds + launches + renders end-to-end** (macOS, hello-world; window verified by
  screenshot; full Chromium multi-process under `cef`).
- **Bake-in caveats:** it's **canary / experimental** today; **pin `desktop.backend`** in
  `deno.json` (the canary defaulted to `cef` despite the docs); gate tooling on the `deno desktop`
  subcommand's presence, not the version string (canary reports `2.8.3+<hash>`).

## The one architectural decision to settle: where does the server run?

herocast keeps `NEYNAR_API_KEY` / `APP_MNENOMIC` server-side (#751) — which assumes a **trusted
remote server**. A desktop binary running the TanStack server *locally* would ship those secrets to
every user.

→ **Hybrid (recommended):** the native UI runs locally, but data/auth server fns **proxy the
deployed worker** (`cf.herocast.xyz`). Secrets stay server-side; local-only surfaces (drafts in
sessionStorage, accounts/settings in IndexedDB) stay local. This is the model **Issue D2** implements.

---

## Plan to get desktop to users — proof-driven, 3 follow-up issues

Sequential: **D1 → D2 → D3.** Each issue ships only when its **PROOF** is captured (a screenshot, a
grep result, a working login). All land **after #13 cutover**.

### D1 — "It runs": the real herocast app under `deno desktop`

**Do:**
- Add a `TARGET=deno` branch to `vite.config.mts` `hostPlugins` (Nitro `deno-server`/`deno-deploy`
  preset, mirroring the existing `vercel` branch) and alias `cloudflare:workers` → the empty stub
  for all environments.
- Add `deno.json` with `{ "desktop": { "backend": "cef" } }`.
- `TARGET=deno vite build` → universal `fetch` server entry; `deno desktop` wraps it.

**PROOF (acceptance):**
- The actual app opens in a desktop window; `/feeds` renders real casts; sidebar nav + opening a
  thread work; no fatal console errors. → screenshot + a 5-line manual checklist in the PR.
- `pnpm web:typecheck` + the existing CF build stay green (the `TARGET=deno` branch is additive).

### D2 — "It's correct & secure": secrets-safe data/auth + key custody

**Do:**
- Implement the **hybrid** server model — data/auth server fns target the remote worker; nothing
  secret in the binary.
- Make the real **login** flow work in the desktop window (if the OAuth callback needs native
  deep-link handling, that piece moves to D3).
- **Signer / private-key custody:** store via the **OS keychain**, not webview IndexedDB — or
  document a hardened interim with a tracked follow-up.

**PROOF:**
- Grep the built app bundle for `NEYNAR_API_KEY` / `APP_MNENOMIC` → **absent**.
- Live: log in + post a cast + load a feed, all from the desktop app against the remote worker.
- Key-custody location documented + verified (keychain entry exists; keys are **not** in IndexedDB).

### D3 — "It's shippable": signing, deep-links, auto-update, a real download

**Do:**
- **Code-sign + notarize** the macOS build (Windows signing if in scope); add a CI release job
  (replaces the deleted Tauri CI).
- Register the **deep-link / custom URL scheme** for the auth callback.
- Wire **`Deno.autoUpdate()`** with a `latest.json` manifest; verify rollback on a bad build.

**PROOF:**
- A signed, notarized build a **non-developer can download from Releases, install, open, and log
  into**.
- Update test: the app pulls + applies a newer build; a deliberately-broken build rolls back.

## Gating preconditions — don't start D1 until

- **#13 cutover is done** (TanStack is the default web app).
- **`deno desktop` has a stable (non-canary) release** — or we *consciously* accept canary risk for
  an early internal beta only.

## Links
- Deno desktop docs — https://docs.deno.com/runtime/desktop/ · backends — https://docs.deno.com/runtime/desktop/backends/
- `phase-1.md §10` — the original open question (now pointed here)
- `strategy.md` — deferred follow-ups
- Spike scaffold + run notes — `scripts/spikes/deno-desktop/` (throwaway)
