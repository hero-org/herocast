# Spike — herocast on the Deno desktop runtime

> **Throwaway.** Validates the open questions in `docs/migration/desktop-deno-runtime.md`
> before any real desktop-target work is scheduled (post-#13 cutover). Delete this whole
> directory once the questions are answered and folded back into the doc.

## What we're de-risking

1. **Toolchain** — can `deno desktop` compile herocast-shaped code into a desktop app bundle?
2. **Seam fall-through** — do herocast's two host-specific server seams degrade on a non-Cloudflare
   runtime (Deno) *by runtime capability*, with no build-target change?
   - `serverEnv()` (`src/web/lib/env.server.ts`) → falls back to `process.env` when the
     `cloudflare:workers` env is absent.
   - `getCacheBackend()` (`src/web/lib/cache.server.ts`) → picks the in-process `MemoryCacheBackend`
     when `caches.default` is absent.
3. **(Documented, not automated) Full app** — running the *built* TanStack Start server under
   `deno desktop`. This needs a `TARGET=deno` build (the vite config today only wires
   `cloudflare` / `vercel`), so it's a follow-up, not part of this scaffold. See "Stage 3" below.

## Prerequisites

- **Stage 2** (the default headless check) runs on any recent Deno: `curl -fsSL https://deno.land/install.sh | sh`.
- **Stage 1** (`--build`) needs the `deno desktop` subcommand, which is **canary-only** today:
  `deno upgrade canary`.
  - ⚠️ The capability gate is the *subcommand's presence*, not a version number: the canary that
    ships `deno desktop` still reports `2.8.3+<hash>` (verified 2026-06-23), so the web docs'
    "ships in Deno v2.9.0" does not match what `deno --version` prints. `deno desktop` is also
    self-described as "experimental and subject to change."

## Run

```sh
./scripts/spikes/deno-desktop/run.sh          # prereq check + Stage 2 (headless, cheap)
./scripts/spikes/deno-desktop/run.sh --build  # also Stage 1: compile the desktop bundle (HEAVY)
```

`--build` is opt-in because on Linux it downloads a **~1.5 GB CEF/Chromium backend** and emits a
**~1.7 GB** app directory (`libcef.so` alone is ~1.5 GB). The runner deletes the bundle afterward;
`.gitignore` here is a backstop so it can never be committed.

## Findings (2026-06-23 — Linux x86_64 cloud sandbox + macOS arm64 device)

- **Stage 2 — PASS (both checks, both OSes).** `serverEnv()` reads the OS env via `process.env`
  (Deno's Node-compat shim populates it with `--allow-env`), and `getCacheBackend()` picks
  `memory`. So the host seams need **zero Deno-specific code** — only the `cloudflare:workers`
  *import* needs aliasing, exactly as the existing `TARGET=vercel` branch already does.
- **Stage 1 — works end-to-end on macOS.** `deno desktop --output Hello.app hello.ts` built a
  signed `.app` in ~20 s (after backend download); `open Hello.app` launched it and the **window
  rendered the HTML** (screenshot-verified). Process tree = full Chromium multi-process. Framework
  auto-detect (`deno desktop` with no arg) confirmed in `--help`. (On the headless Linux sandbox
  the same command *builds* but can't open a window — no display.)
- **Size is `--backend`-dependent — I measured CEF only.** `deno desktop --backend cef|webview|raw`:
  - **CEF (measured):** macOS arm64 **295 MB `.app`** (225 MB = Chromium Embedded Framework);
    Linux x86_64 **~1.7 GB** (`libcef.so` ~1.5 GB, likely unstripped canary). Electron-class.
  - **`webview` (native OS webview — NOT TESTED):** docs promise much smaller binaries ("code + a
    backend shim"), at the cost of per-OS rendering quirks + no DevTools. A later size optimization,
    not a blocker — `cef` is the chosen default for rendering fidelity.
- **⚠️ Two canary-vs-docs drifts:** (1) version reports `2.8.3+<hash>`, not the documented `2.9.0`
  — gate on the subcommand's presence; (2) the canary **defaulted to CEF** though docs say
  `webview` is default — **pin `desktop.backend` explicitly**.

## Stage 3 (follow-up, not in this scaffold)

To actually run the herocast TanStack app in a desktop window:

1. Add a `TARGET=deno` branch to `vite.config.mts` `hostPlugins` (a Nitro `deno-server`/`deno-deploy`
   preset, mirroring the existing `vercel` branch) and alias `cloudflare:workers` → the empty stub
   for all environments (same as the non-CF branch already does).
2. `TARGET=deno vite build` → a Node/Deno server entry (universal `fetch` handler).
3. Point `deno desktop` at the project; confirm its TanStack Start auto-detection serves the built
   output, then exercise `/feeds` in the window.
4. Then tackle the native-API questions from the doc: OS keychain for signer storage, OAuth
   deep-link callback, notifications, and the wallet/TipTap stack under the native webview.

Record outcomes back into `docs/migration/desktop-deno-runtime.md`, then delete this directory.
