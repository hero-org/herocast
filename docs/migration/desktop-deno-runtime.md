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
| Webview | OS-native (small binaries, like WRY — not bundled Chromium) | OS-native (WRY) |
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

## Recommendation & timing

- **Do not revive Tauri.** It is dormant, needs Rust, and would still need a custom shim to
  consume the TanStack app. Deno desktop subsumes that work via the existing portability seam.
- **Park behind #13 cutover.** This cannot land while Next is the live app. Re-evaluate once
  the TanStack app is the default web build.
- **Caveat — canary.** Deno desktop ships in Deno v2.9.0 and is not yet stable
  (`deno upgrade canary`; the command, config keys, and TS APIs may change). Fine for a spike
  now; not for a shipped binary until it stabilizes. The timing works in our favor.

## Links
- Deno desktop docs — https://docs.deno.com/runtime/desktop/
- `phase-1.md §10` — the original open question (now pointed here)
- `strategy.md` — deferred follow-ups
- Spike scaffold — `scripts/spikes/deno-desktop/` (throwaway; see its README)
