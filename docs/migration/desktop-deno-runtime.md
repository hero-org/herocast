# Desktop consumer — Deno desktop runtime

> Resolves the **open question** parked in `phase-1.md §10` ("the desktop build currently
> targets the Next app; how it consumes the TanStack app must be resolved before Phase 4
> cutover"). This is the recommended answer. **Deferred until after #13 cutover** — it cannot
> and should not land while Next is still the live app — but the decision is made here so the
> §10 question is closed rather than open.

## TL;DR

Ship the desktop app as the **same TanStack Start app**, wrapped by the [Deno desktop
runtime](https://docs.deno.com/runtime/desktop/), instead of reviving Tauri. Deno desktop
auto-detects and runs TanStack Start natively, so the desktop binary *is* the migrated app —
no separate "consumer" shim. It reuses the host-portability seam the migration was built
around (`vite.config.mts`: universal `fetch` server entry, host = build-plugin swap). It is
currently **canary / pre-release**, which is fine given the timing (desktop is dormant; this
lands after cutover).

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
| Webview | **Backend-dependent — verify per OS.** On Linux the spike got a **CEF/Chromium** backend (~1.7 GB bundle), *not* a lean native webview; macOS/Windows may use native WKWebView/WebView2 (unverified) | OS-native (WRY) — genuinely small |
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

## Spike results (run 2026-06-23, Deno canary aa90115, Linux x86_64)

Ran via `scripts/spikes/deno-desktop/run.sh` (see that dir for the scaffold).

- **Seam fall-through — PASS (both checks).** On Deno, `serverEnv()` reads the OS env via
  `process.env` (Node-compat shim, populated with `--allow-env`) and `getCacheBackend()` picks the
  in-process `memory` backend. **The host seams need zero Deno-specific code** — only the
  `cloudflare:workers` *import* needs aliasing, which the existing `TARGET=vercel` branch already
  does. This confirms Deno is a build-target swap, not a code change. ✅
- **`deno desktop` exists and compiles a bundle.** Subcommand present on canary; framework
  auto-detect confirmed in `--help`. Bare `deno desktop <script>` *builds* a redistributable app
  dir (window launch is `--hmr` / a display, n/a in the headless container).
- **⚠️ Two claims from the marketing did NOT hold on Linux:**
  1. **Version** — the canary that ships `deno desktop` reports `2.8.3+<hash>`, not the documented
     `2.9.0`. Gate on the subcommand's presence, never a version number.
  2. **"Small binaries / native webview"** — Linux pulled a **~1.5 GB CEF/Chromium backend** →
     **~1.7 GB** app bundle. This is the single biggest open risk to the "lean, Tauri-like"
     pitch; **measure macOS/Windows bundle sizes before committing** (they may use native
     WKWebView/WebView2 and be far smaller, but that's unverified).

## Recommendation & timing

- **Lean toward Deno desktop over reviving Tauri — but the bundle-size finding is now a real
  gate, not a footnote.** The architectural fit is proven (seam fall-through PASS; auto-detects
  TanStack Start; no Rust; one portability seam). What's *not* proven is the "small binaries"
  pitch: Linux shipped ~1.7 GB of CEF. If macOS/Windows also land on Chromium, that erases the
  main advantage over Tauri's lean WRY, and Tauri (or Electron, which we'd then be matching on
  size anyway) returns to the table. **Decision rule: measure macOS/Windows bundles in Stage 3;
  if they're native-webview-small, commit to Deno desktop; if they're also Chromium-heavy,
  re-open the Tauri-vs-Deno-vs-Electron call with size as a first-class criterion.**
- **Park behind #13 cutover.** This cannot land while Next is the live app. Re-evaluate once
  the TanStack app is the default web build.
- **Caveat — canary + experimental.** `deno desktop` is canary-only and self-labeled
  "experimental and subject to change" (the command, config keys, and TS APIs may move). Note the
  canary reports `2.8.3+<hash>`, *not* the documented `2.9.0`. Fine for a spike now; not for a
  shipped binary until it stabilizes. The timing works in our favor.

## Links
- Deno desktop docs — https://docs.deno.com/runtime/desktop/
- `phase-1.md §10` — the original open question (now pointed here)
- `strategy.md` — deferred follow-ups
- Spike scaffold — `scripts/spikes/deno-desktop/` (throwaway; see its README)
