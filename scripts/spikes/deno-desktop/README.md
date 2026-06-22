# Spike — herocast on the Deno desktop runtime

> **Throwaway.** Validates the open questions in `docs/migration/desktop-deno-runtime.md`
> before any real desktop-target work is scheduled (post-#13 cutover). Delete this whole
> directory once the questions are answered and folded back into the doc.

## What we're de-risking

1. **Toolchain** — can `deno desktop` open a native OS-webview window on a dev machine at all?
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

Deno desktop ships in **Deno v2.9.0 and is canary-only** today:

```sh
# install deno, then:
deno upgrade canary
deno --version   # expect >= 2.9.0
```

The command / config keys / TS APIs may change before stable — treat any green result as
"works on the canary I ran", not a stable contract.

## Run

```sh
./scripts/spikes/deno-desktop/run.sh
```

The runner checks for a new-enough Deno, then runs:
- **Stage 1** — `deno desktop hello.ts` → a native window titled "herocast — deno desktop spike".
  Close it to continue. (Skipped automatically if no display is available, e.g. CI/SSH.)
- **Stage 2** — `deno run seam-fallthrough.ts` → asserts the env + cache fall-through and prints
  a PASS/FAIL table. This one is headless and safe to run anywhere Deno is installed.

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
