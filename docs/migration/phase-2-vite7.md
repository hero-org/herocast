# Unit #1 — chore: bump vite 6→7 (unblocks the Vercel build target)

> Epic #754 · Track B (Next→TanStack-Start-on-Cloudflare). Status: **✅ merged.** Bootstrap: `strategy.md` + `conventions.md` + `phase-1.md §0.1`. All paths under repo root; all new app code stays in `src/web/`.

## Objective

Bump `vite` 6→7 (+ the matching `@vitejs/plugin-react`) in the **isolated** TanStack build, and — as the payoff — re-enable the **Vercel host target** that Phase 1 left gated on vite 7 (`phase-1.md §0.1`). vite is consumed **only** by the `src/web` TanStack/Vite build; `next.config.mjs` has zero vite refs, so the bump **cannot** reach the live Next/Vercel app.

## Non-goals

- Touching the live app (`app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`) or any live-app script.
- Porting routes, providers, stores — owned by units #2–#13.
- A real `vercel deploy` from CI (the gate was *build-output emission*, which is proven locally; CI deploy is a #0/cutover concern).
- Bumping shared live-app deps to chase vite-7 peer warnings (see **Accepted nits** — out of scope for an isolated bump; they risk the live app).

## What changed (definition of done — all met)

| File | Change |
|------|--------|
| `package.json` | `vite ^6.4.0` → **`^7.3.5`**; `@vitejs/plugin-react ^4.3.0` → **`^5.2.0`**; re-added `nitro 3.0.260603-beta` (devDep) + `cross-env` already present; new script `web:build:vercel: cross-env TARGET=vercel vite build`. |
| `vite.config.mts` | Static `import { nitro } from 'nitro/vite'`; the non-CF host-plugin slot now returns `[nitro({ config: { preset: 'vercel' } })]` (was `[]`). Header + slot comments updated. **Plugin order unchanged** (host → tanstackStart → viteReact → tsconfigPaths). |
| `pnpm-lock.yaml` | Resolves a single `vite@7.3.5` + single `rollup@4.53.5` (no duplicate vite/react/rollup). |
| `docs/migration/phase-1.md` | §0.1 + §8 table updated from "blocked, re-enable later" to the shipped vite-7 / Vercel-unblocked state. |

## Version decisions

- **`@vitejs/plugin-react ^5.2.0`** — `npm view` shows 5.2.0 is the **last 5.x** release; its peer is `vite ^4||^5||^6||^7||^8`. The 6.x line peer-requires `vite ^8` only, so `^5` (`<6.0.0`) is the correct pin to stay on the vite-7 line. `^5.2.0` is effectively a pin today (no 5.2.x/5.3.x exist) — intentional.
- **Peer chain verified clean** after the bump: `@cloudflare/vite-plugin@1.40.0` peer `vite ^6.1.0||^7||^8` ✅; `@tanstack/react-start@1.168.25` peer `vite >=7.0.0` — the bump **fixed** the previously-tolerated mismatch (vite 6 violated it) ✅; `nitro` peer `vite ^7||^8` ✅.
- **`build.target` default shift (vite 7):** `'modules'` → `'baseline-widely-available'` (Chrome/Edge 107+, FF 104+, Safari 16+, ~mid-2023). No explicit `build.target` is set, so the client downlevel target shifted as a side effect. **Accepted** — modern targets, smaller output, no risk for a power-user client. (Pin `build.target: 'modules'` in `vite.config.mts` if a regression ever surfaces.)

## Stretch — Vercel target unblocked (✅)

Exactly as `phase-1.md §0.1` predicted: nitro v3's Vercel Build-Output finalize runs in vite 7's `buildApp` **plugin** hook, which **vite 6 never invoked** (build exited 0 but emitted only static assets). On vite 7 the hook fires. `pnpm web:build:vercel` now emits a deployable **Build Output API v3** tree:

```
.vercel/output/
  config.json                       # version:3, routes: assets cache → filesystem → /(.*) → /__server
  functions/__server.func/          # .vc-config.json: launcherType Nodejs, streaming, runtime = build-node major
  static/
  nitro.json                        # nitro preset metadata
```

> **Gotcha — the function `runtime` tracks the BUILD-TIME node major** (nitro's vercel preset derives it): build on node 22 → `"runtime": "nodejs22.x"`; build on node 20 → `"nodejs20.x"` (verified both). So the **#0 CI prebuild / #13 cutover must run `web:build:vercel` on node ≥22**, else it ships functions pinned to EOL `nodejs20.x`. Matches the `conventions.md` node-≥22 rule for `web:*` scripts.

`.vercel/` and `dist/` are gitignored — no build artifacts committed. `TARGET=cloudflare` (default) build is **unaffected**: resolved-config inspection confirms `nitro` never appears on the CF/default path and `cloudflare()` stays first.

## Accepted nits (deliberately NOT actioned — out of scope for an isolated vite bump)

Both reviews (codex + the 30-agent verify workflow) surfaced these. All touch **shared live-app config**; acting on them would break this unit's isolation guarantee and risk the live Next/Vercel app for benign, advisory warnings. Recorded here so they aren't re-litigated:

- **`@types/node ^20.17.24`** is below vite 7's *optional* peer `^20.19.0 || >=22.12.0`. Optional peer; the TanStack tsconfig uses `types: ["vite/client"]` (not `@types/node`), so `web:typecheck` is green. Shared with the live Next app (node 20) → bumping risks the live typecheck. **Leave.**
- **`engines.node: ">=22"`** permits 22.0–22.11, below vite 7's `>=22.12.0` floor. The live app deploys under this field → tightening risks the live Vercel build. In practice migration uses node 22.22.x (`nvm use 22`, `conventions.md` R-node). Vite only *warns* on a low node (warn-only guard, not fatal). **Leave.**
- **`.nvmrc` = `v20.12.2`** is the **live Next app's deliberate pin** (`conventions.md` line 36 mandates `nvm use 22` in migration workspaces instead). **Must not change.**
- **`rollup@4.53.5`** is below nitro's peer `^4.60.4` (Vercel build verified working anyway). rollup is the bundler for the **proven CF path** too → a direct rollup devDep would alter it and force CF re-verification for a gated-path warning. **Leave.**
- **`nitro 3.0.260603-beta`** is a calendar prerelease (no stable nitro 3.x exists; it's the `latest` dist-tag). The **exact pin (no caret)** is the correct mitigation — a caret on a calendar-beta is meaningless. **Keep exact-pinned.**

## cf-canary acceptance (verified, node 22)

- `pnpm web:build` ✅ green, bundle **< 3 MB gzip**.
- `pnpm web:typecheck` ✅ 0 · live `pnpm typecheck` ✅ 0 (coexistence).
- `pnpm web:serve` (`wrangler dev`) → `/migration-probe`, `/providers-probe`, `/nav-probe` all **200**.
- `pnpm web:build:vercel` ✅ → `.vercel/output/{config.json, functions/__server.func, static/}` emitted (deployability gate met).
