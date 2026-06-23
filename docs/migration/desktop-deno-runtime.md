# Desktop consumer — Deno desktop runtime

> Resolves the **open question** parked in `phase-1.md §10` ("the desktop build currently
> targets the Next app; how it consumes the TanStack app must be resolved before Phase 4
> cutover"). This is the recommended answer. **Deferred until after #13 cutover** — it cannot
> and should not land while Next is still the live app — but the decision is made here so the
> §10 question is closed rather than open.

## TL;DR

Candidate: ship the desktop app as the **same TanStack Start app**, wrapped by the [Deno desktop
runtime](https://docs.deno.com/runtime/desktop/), instead of reviving Tauri. Deno desktop
auto-detects and runs TanStack Start natively, so the desktop binary *is* the migrated app —
no separate "consumer" shim, and it reuses the host-portability seam the migration was built
around (`vite.config.mts`: universal `fetch` server entry, host = build-plugin swap; the seam
fall-through is **spike-verified**).

**Reality check from the spike (don't skip):** Deno desktop is **Chromium-backed (CEF) —
Electron-class, NOT the lean native-webview runtime the marketing implies**. A hello-world `.app`
is **295 MB on macOS** (verified on-device; window launches + renders). So the choice is **DX +
portability (one TS codebase, no Rust) vs. binary size** — if a small native binary is a hard
requirement, **Tauri** is still the only option here. It's also **canary / experimental** today,
which is fine given the timing (desktop is dormant; this lands after #13 cutover).

## Current state (why this is even a question)

CLAUDE.md still describes Tauri as the desktop platform, but on the migration branch the Tauri
integration is **dormant**:

- No `src-tauri/` directory; the `rls` / `rls:debug` / `rls:mac-universal` scripts CLAUDE.md
  references no longer exist in `package.json`.
- The Tauri steps in `.github/workflows/build.yaml` are fully commented out.
- `CONTRIBUTING.md`: desktop is "...coming back soon via tauri...".

So there is no working desktop build to preserve — the field is open. Meanwhile the migration
(epic #754) deliberately made the app **host-portable**: TanStack Start emits a universal
WHATWG `fetch(request)` server entry, and the host is a build-plugin swap
(`TARGET=cloudflare` vs `vercel`), not a code change (`vite.config.mts:9-20`). The only
host-specific seams are env access (`cloudflare:workers` → `process.env` fallback in
`env.server.ts`) and the edge cache (`CacheBackend` in `trending.server.ts`), and both already
degrade gracefully on non-CF runtimes. **That portability is what makes Deno desktop a
build-target swap rather than a rewrite** — Deno becomes a third host alongside CF and Vercel.

## Why Deno desktop over reviving Tauri

| | Deno desktop | Tauri (dormant) |
|---|---|---|
| Consumes the TanStack app | **Natively** — auto-detects TanStack Start, runs the prod server in-process | Needs a custom shim to point a webview at the app |
| Toolchain | All TypeScript; cross-compiles macOS/Win/Linux from one machine | Requires Rust + per-platform native build setup |
| Webview | **CEF / full Chromium (Electron-class).** Verified on macOS (295 MB hello-world `.app`) and Linux (~1.7 GB) — *not* a lean native webview | OS-native (WRY) — genuinely small (~10–30 MB) |
| Auto-update | Built in — binary-diff via `latest.json` manifest + rollback | Hand-wired (was never finished here) |
| Native APIs | `Deno.BrowserWindow` (windowing), `Deno.autoUpdate()`, `bindings` (webview→Deno) | Rust commands |
| Bundle limits | None — the workerd 3 MB diet in `vite.config.mts` is **not needed** on desktop | None |

The workerd-bundle stubs (`WalletProviders`, `NewCastEditor`, `VideoEmbed`, the hub-web
factories, `node:tty`) exist only to fit Cloudflare's 3 MB compressed Worker limit. A desktop
target has no such limit, so the desktop build is *simpler* than the CF one.

## The decision that matters: local server vs. remote server

This is a **secrets** problem. herocast deliberately keeps `NEYNAR_API_KEY` and `APP_MNEMONIC`
server-side (#751; `vite.config.mts` forces them to `undefined` in client bundles). That model
assumes a **trusted remote server**. A Deno desktop binary that runs the server *on the user's
machine* breaks that assumption. Two shapes follow:

- **(A) Self-contained / local server** — Deno desktop's headline mode: the TanStack server is
  bundled into the binary, the webview hits `localhost`, works offline. But server fns then run
  locally, so any baked-in secret ships to every user; you also lose the edge cache. Only viable
  if those keys move to a per-user model.

- **(B) Hybrid — RECOMMENDED** — the desktop binary runs the **UI / client** natively, but
  data + auth server fns proxy to the already-deployed remote worker (`cf.herocast.xyz`).
  Secrets stay server-side, the edge cache stays, and you still get native windowing /
  auto-update / deep links. Preserves the "one codebase, host = build swap" promise with no
  secret leak. Local-only surfaces that already work in any webview (drafts in sessionStorage,
  accounts/settings in IndexedDB) stay local regardless.

Default to **(B)**; reserve **(A)** only for genuinely local surfaces.

## Open questions to settle in a spike (see the spike scaffold)

1. **Build consumption** — does `deno desktop` run TanStack Start's default Node/Deno server
   output, or does it need a dedicated `TARGET=deno` preset? Confirm the CF-only seams
   (`cloudflare:workers`, `CacheBackend`) fall through cleanly on Deno as documented.
2. **Native API maturity for herocast's needs** — OS keychain for signer/private-key storage,
   OAuth deep-link callback handling (Farcaster auth-kit / Supabase redirect), notifications.
   Windowing + auto-update are documented; keychain is the unknown.
3. **Interactive stack under the native webview** — wallet (wagmi / rainbowkit / auth-kit) and
   the TipTap editor under React 19 + SSR (still flagged un-QA'd in `phase-1.md §10`).

## Spike results (Linux x86_64 cloud sandbox + macOS arm64 device, 2026-06-23)

Ran via `scripts/spikes/deno-desktop/run.sh` (see that dir for the scaffold). Stage 1 (the real
`deno desktop` build + window launch) was run on a macOS arm64 device; Stage 2 ran on both.

- **Seam fall-through — PASS (both checks, both OSes).** On Deno, `serverEnv()` reads the OS env
  via `process.env` (Node-compat shim, populated with `--allow-env`) and `getCacheBackend()` picks
  the in-process `memory` backend. **The host seams need zero Deno-specific code** — only the
  `cloudflare:workers` *import* needs aliasing, which the existing `TARGET=vercel` branch already
  does. This confirms Deno is a build-target swap, not a code change. ✅
- **`deno desktop` works end-to-end on macOS.** Built `hello.ts` → a signed `Hello.app`, launched
  it, and the window **rendered the HTML** (verified by screenshot). Process tree is full Chromium
  multi-process (GPU / network / storage / renderer helpers). Build was fast (~20 s after the
  backend download). Framework auto-detect (`deno desktop` with no arg) confirmed in `--help`.
- **❌ The "small binaries / native webview" pitch is FALSE on both platforms tested.** The default
  backend is **CEF (full Chromium)**, not WKWebView/WebView2/WRY:
  - **macOS arm64: a 295 MB `.app`** for a hello-world — 225 MB of that is
    `Chromium Embedded Framework.framework`. That is **Electron-class, not Tauri-class** (Tauri
    ships ~10–30 MB via the OS webview).
  - **Linux x86_64: a ~1.7 GB app dir** (`libcef.so` ~1.5 GB — likely an unstripped canary build;
    macOS shows the framework can be far smaller, but it is still Chromium either way).
- **⚠️ Version reporting:** the canary that ships `deno desktop` reports `2.8.3+<hash>`, *not* the
  documented `2.9.0`. Gate on the subcommand's presence, never a version number. `deno desktop` is
  also self-labeled "experimental and subject to change."

## Recommendation & timing

- **The "small binary" advantage over Tauri does NOT exist — decide on DX vs. size, with eyes
  open.** Deno desktop is Chromium-backed (Electron-class: 295 MB on macOS for hello-world). It is
  *not* the lean, Tauri-like runtime the marketing implies. What it genuinely buys us is **DX +
  portability**: one TypeScript codebase, native TanStack-Start auto-detect, no Rust toolchain, and
  it reuses our existing host-portability seam (seam fall-through verified). The trade is real:
  - **Choose Deno desktop** if all-TS DX and "the desktop app *is* the TanStack app" outweigh
    bundle size, and we accept Electron-class downloads + a canary/experimental dependency.
  - **Choose Tauri** if a small binary is a hard requirement (the only small-webview option here;
    cost is the Rust toolchain + a shim to consume the TanStack app).
  - **Electron** is no longer obviously worse on size, but adds nothing Deno desktop doesn't.
  - My lean: **size is rarely a dealbreaker for a power-user desktop client, and the all-TS /
    auto-detect DX is a big maintenance win — so Deno desktop, contingent on it reaching a stable
    (non-canary) release before we ship.** If herocast wants to advertise a tiny native app, Tauri
    wins instead.
- **Park behind #13 cutover.** This cannot land while Next is the live app. Re-evaluate once the
  TanStack app is the default web build — and once `deno desktop` is out of canary.
- **Remaining unknowns (don't block the decision, do block shipping):** Windows/WebView2 path,
  Stage 3 (the *real* app, not hello-world, under `deno desktop` via a `TARGET=deno` build),
  auto-update in practice, and the native-API needs (OS keychain for signers, OAuth deep-link
  callback, notifications) + the wallet/TipTap stack under CEF.

## Links
- Deno desktop docs — https://docs.deno.com/runtime/desktop/
- `phase-1.md §10` — the original open question (now pointed here)
- `strategy.md` — deferred follow-ups
- Spike scaffold — `scripts/spikes/deno-desktop/` (throwaway; see its README)
