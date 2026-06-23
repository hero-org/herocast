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

**Reality check from the spike (don't skip):** Deno desktop has **three selectable backends**
(`--backend cef|webview|raw`, or `desktop.backend` in `deno.json`). The two that matter:
- **`webview`** — native OS WebView (WKWebView / WebView2 / WebKitGTK). "Just your code plus a
  backend shim" → **Tauri-like sizes**. Docs say it's the default. **NOT YET TESTED here** — and it
  carries the classic native-webview catch: per-OS rendering/feature inconsistency (WebGPU, Web
  Audio), and **no DevTools**. herocast's heavy UI (TipTap, HLS video embeds, wallet flows) is
  exactly the kind of surface that exposes WebKitGTK/WKWebView quirks.
- **`cef`** — bundled Chromium. Identical cross-platform rendering + full web platform + DevTools,
  at **~295 MB** (measured on macOS, hello-world; window launches + renders). Electron-class.

⚠️ The canary I tested **silently defaulted to CEF** despite the docs saying `webview` is default
(same canary-vs-docs drift as the version string) — so **pin `desktop.backend` explicitly**. The
size verdict is therefore backend-dependent, not a flat "Electron-class." Net: Deno desktop can be
**Tauri-like (webview) OR Electron-like (cef) from one codebase** — which is arguably *better* than
either, IF the webview backend renders herocast's UI correctly across OSes (the open risk). It's
also **canary / experimental** today, which is fine given the timing (desktop is dormant; this
lands after #13 cutover).

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
| Webview | **Selectable: `webview` (native, Tauri-like size, untested + per-OS quirks) or `cef` (Chromium, 295 MB macOS verified, consistent + DevTools).** Pin it via `desktop.backend` | OS-native (WRY) — genuinely small (~10–30 MB), no choice |
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
- **Size is backend-dependent — and I only measured CEF.** Deno desktop has `--backend cef|webview|raw`:
  - **CEF (what I measured):** macOS arm64 **295 MB `.app`** for hello-world (225 MB =
    `Chromium Embedded Framework.framework`); Linux x86_64 **~1.7 GB** (`libcef.so` ~1.5 GB, likely
    unstripped canary). Electron-class, consistent rendering, DevTools.
  - **`webview` (native OS webview — NOT YET TESTED):** docs promise "just your code plus a backend
    shim" → Tauri-like size, at the cost of per-OS rendering/feature inconsistency + no DevTools.
    **This is the single highest-value remaining probe** (run `--backend webview` with herocast's
    real UI). My earlier "no small-binary advantage" line was wrong — it was CEF-only.
- **⚠️ Two canary-vs-docs drifts — gate on actual behavior, not the docs:**
  1. **Version** reports `2.8.3+<hash>`, not the documented `2.9.0`. Gate on the subcommand's presence.
  2. **Default backend** was **CEF** in the canary I ran, though docs say `webview` is default. So
     **always pin `desktop.backend` explicitly** rather than relying on the default. `deno desktop`
     is also self-labeled "experimental and subject to change."

## Recommendation & timing

- **Deno desktop is the leading candidate — its key edge is that ONE codebase spans both size
  tiers.** It buys us **DX + portability**: one TypeScript codebase, native TanStack-Start
  auto-detect, no Rust toolchain, and it reuses our verified host-portability seam. Unlike Tauri
  (always small webview) or Electron (always Chromium), Deno desktop lets us pick `--backend
  webview` (Tauri-like size) or `--backend cef` (Electron-like, consistent rendering + DevTools)
  per build — even ship webview as default and offer a CEF build for users who hit rendering bugs.
  - **Choose Tauri instead** only if a small binary is a *hard* requirement AND we don't trust the
    `webview` backend's maturity (cost: Rust toolchain + a shim to consume the TanStack app).
  - **Electron** adds nothing Deno desktop doesn't.
  - My lean: **Deno desktop**, defaulting to the `webview` backend if it renders herocast cleanly
    (the open probe), falling back to CEF if not — contingent on it reaching a **stable
    (non-canary)** release before we ship.
- **Park behind #13 cutover.** This cannot land while Next is the live app. Re-evaluate once the
  TanStack app is the default web build — and once `deno desktop` is out of canary.
- **Remaining unknowns (don't block the decision, do block shipping):**
  1. **`--backend webview` size + rendering fidelity for herocast's real UI** (TipTap, HLS video,
     wallet) across macOS/Windows/Linux — *the* gating probe; decides the size story.
  2. **Stage 3** — the real app (not hello-world) under `deno desktop` via a `TARGET=deno` build.
  3. **Native-API needs** — OS keychain for signer/private-key storage, OAuth deep-link callback
     (Farcaster auth-kit / Supabase), notifications, and auto-update in practice.
  4. **Windows/WebView2 path** (untested).

## Links
- Deno desktop docs — https://docs.deno.com/runtime/desktop/
- `phase-1.md §10` — the original open question (now pointed here)
- `strategy.md` — deferred follow-ups
- Spike scaffold — `scripts/spikes/deno-desktop/` (throwaway; see its README)
