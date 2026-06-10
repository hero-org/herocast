# Unit #0 — infra: `cf.herocast.xyz` canary deploy + CI prebuild

> **Epic #754 · Migration unit #0** (see `strategy.md` for the map, `conventions.md` for the reuse contract).
> Size **S**. Blocked by: nothing. Unblocks the API tier (#10 data routes, #11 auth/onchain) and gives **every** future unit a REAL deployed canary to verify against.

**One-line goal:** stand up a hands-off deploy of the TanStack Start worker (`herocast-web` → `cf.herocast.xyz`) on every push to the migration branch, so a unit's "done" is a live URL — with the Next.js/Vercel app **completely untouched**.

This unit ships **infra + config only**. It does **not** port any page, route, provider, or store — those are owned by units #2–#12. The probes it deploys (`/migration-probe`, `/providers-probe`, `/nav-probe`) already exist on the branch from Phase 1 + units #2/#3.

---

## 1. Objective & Non-Goals

### Objective
1. **Conductor**: a fresh migration workspace installs the canary toolchain and can run the canary from the Run button (`.conductor/settings.toml`), with local secrets copied in automatically (`.worktreeinclude`).
2. **CI**: a GitHub Actions workflow (`.github/workflows/cf-web-canary.yml`) prebuilds (node 22 + `pnpm rebuild esbuild workerd`) and `wrangler deploy`s the worker on every push to `hellno/cloudflare-hosting-state` — gated so it can never touch prod/Vercel.
3. **Runbook**: the one-time manual steps (CF login, `wrangler secret put`, GitHub repo secrets, custom domain) documented here with **no secret values committed anywhere**.

### Non-Goals
- ❌ Porting any page / API route / provider / store (units #2–#12).
- ❌ Touching the live app: `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, or the `dev`/`build`/`start` scripts.
- ❌ Cutover / making TanStack the default app / changing `herocast.xyz` DNS (unit #13).
- ❌ Putting any secret value in a committed file (all secrets are `wrangler secret put` / GitHub Actions secrets).
- ❌ Changing the worker's runtime contract (`wrangler.jsonc` is Phase-1 and stays as-is).

---

## 2. Definition of Done / Acceptance

- [x] `.conductor/settings.toml`: `setup` installs deps + `pnpm rebuild esbuild workerd`; Run button is **branch-aware** — the canary (`web:build && web:serve`) on `migration/*` / `*cloudflare*` branches, the live Next app (`pnpm dev`) everywhere else (incl. `main`); `run_mode = "concurrent"`.
- [x] `.worktreeinclude` copies `.dev.vars` + `.env.local` into every new workspace (the existing `.env*` glob already matches `.env.local`; `.dev.vars` is listed explicitly — **already satisfied, unchanged**).
- [x] `.github/workflows/cf-web-canary.yml`: triggers on push to the migration branch + `workflow_dispatch`; node 22; `pnpm install` → `pnpm rebuild esbuild workerd` → `pnpm web:build` → `wrangler deploy -c dist/server/wrangler.json`; uses `secrets.CLOUDFLARE_API_TOKEN` + `secrets.CLOUDFLARE_ACCOUNT_ID`; branch-gated (filter **and** a job-level ref guard) so it never runs on `main`/PRs.
- [x] YAML + TOML parse clean; no secret literal in any committed file.
- [ ] **(manual, requires CF auth)** GitHub repo secrets set → push → workflow deploys → `curl https://cf.herocast.xyz/migration-probe` and `/providers-probe` return **200**. (See §7 — not runnable from the authoring environment, which has node 20 and no CF token.)

**Coexistence guarantee:** `git diff origin/main` for this unit touches only `.conductor/settings.toml`, `.github/workflows/cf-web-canary.yml`, `docs/migration/*`, and `strategy.md`'s status cell. Zero changes to `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, `package.json`, `vite.config.mts`, or `wrangler.jsonc`.

---

## 3. Files in / out

| File | Action | Why |
|------|--------|-----|
| `.conductor/settings.toml` | **edit** | Branch-aware Run button (canary on migration branches, live Next app elsewhere); keep the `pnpm rebuild esbuild workerd` setup step. |
| `.worktreeinclude` | unchanged | Already copies `.env*` + `.dev.vars`. |
| `.github/workflows/cf-web-canary.yml` | **new** | Branch-gated auto-deploy of the worker. |
| `docs/migration/phase-2-infra-canary.md` | **new** | This spec + the manual runbook. |
| `docs/migration/strategy.md` | **edit** | Flip unit #0 status → ✅. |

**Reuse (do NOT reinvent):** the `web:*` scripts in `package.json`, `wrangler.jsonc` (worker name/compat), the `cloudflareWorkers` env seam (`src/web/lib/env.server.ts`), and the existing probes. This unit adds *no* application code.

> **Why the Run button is branch-aware.** `.conductor/settings.toml` is shared committed config — it merges to `main` with this unit. A flat `run = "pnpm web:serve"` would repoint **every** contributor's Run button (on `main`) from the live Next dev server to the slower canary build+serve, a real dev-workflow regression. The `case "$(git rev-parse --abbrev-ref HEAD)" in migration/*|*cloudflare*)` guard scopes the canary Run to migration branches only and falls back to the live app (and to the live app on a git failure / detached HEAD), so merging this file to `main` changes nothing for normal work. At cutover (#13) the guard can be dropped once the canary *is* the app.

---

## 4. CI design notes (the footguns this avoids)

- **Branch isolation, two layers.** `on.push.branches: [hellno/cloudflare-hosting-state]` + a job-level `if: github.ref == 'refs/heads/hellno/cloudflare-hosting-state'`. The `if` guard matters because `workflow_dispatch` can be launched against any branch — without it, a manual run from `main` would deploy. With it, the only ref that can reach Cloudflare is the migration branch.
- **No `next build`, no Vercel.** The job only runs `vite build` (via `web:build`) + `wrangler deploy`. The Vercel project, `herocast.xyz` DNS, and the Next build graph are never invoked.
- **Node 22, deliberately divergent from the live CI.** `build.yaml` pins node 20.12.2 for the Next app; this workflow uses node 22 because wrangler/workerd require it. Independent graphs ⇒ safe.
- **`pnpm rebuild esbuild workerd`** is a discrete step — pnpm v10 skips native postinstall scripts, so without it the build/deploy fails (R3, `phase-1.md §6`).
- **Pinned wrangler.** Deploy runs `pnpm exec wrangler` (the repo-pinned `4.98.0`), not a floating action version, so CI matches local.
- **Least privilege + single-flight.** `permissions: contents: read`; `concurrency` cancels superseded deploys.
- **Runtime vs build secrets.** CI needs ONLY `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. The worker's runtime secrets (`NEYNAR_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set once via `wrangler secret put` and persist on the worker across deploys — they are not in CI. The `VITE_*` build vars are optional repo secrets, inlined at build time.
- **Probe smoke test (two tiers).** The deploy step captures the `*.workers.dev` URL wrangler prints; a **blocking** step then curls `/migration-probe` + `/providers-probe` on that live URL expecting 200. Both probes 200 even with NO secrets set (migration-probe renders the empty state; providers-probe is client-rendered), so this gates purely on "did the worker deploy and serve?" — meaningful from the very first deploy, no DNS required. A **second, non-blocking** step curls the eventual `cf.herocast.xyz` custom domain — flip its `continue-on-error` to false once DNS resolves (§7 step 4) to make the custom domain a hard gate too.

---

## 5. Env surfaces (no values here — templates only)

Two surfaces, mirroring `phase-1.md §7`:

**Server-runtime secrets** — worker `env`, read inside handlers via `serverEnv()`. Set ONCE per worker; persist across deploys:
```bash
wrangler secret put NEYNAR_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

**Client build-time vars** — `import.meta.env.VITE_*`, inlined by Vite at `web:build` (public once bundled; not `wrangler secret put`). Authoritative list lives in `.env.local.example`; the probes/providers use:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_POSTHOG_KEY=
```
> Locally these live in `.dev.vars` (server) + `.env.local` (client), both gitignored and auto-copied into new workspaces by `.worktreeinclude`. In CI, pass `VITE_*` as optional GitHub repo secrets (the build step already references them; unset → empty, build still succeeds).

---

## 6. One-time Cloudflare setup (manual)

CF account + the `herocast-web` worker already exist (Phase 1, `phase-1.md §7`). To make CI deploys land on `cf.herocast.xyz`:

1. **Auth (local, once):** `wrangler login` (or export `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`). Verify with `wrangler whoami`.
2. **Runtime secrets (once per worker):** run the three `wrangler secret put` commands in §5 and paste the live values when prompted. These persist on the worker; CI deploys reuse them.
3. **Custom domain:** Cloudflare dashboard → **Workers & Pages → `herocast-web` → Settings → Domains & Routes → Add → Custom Domain →** `cf.herocast.xyz`. Cloudflare provisions the DNS + cert automatically (the zone `herocast.xyz` must be on this Cloudflare account). This is a brand-new hostname — it does NOT touch the `herocast.xyz` apex / `www` records the live Vercel app uses.
4. **GitHub repo secrets (for CI):** repo → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` — a scoped token with **Account → Workers Scripts: Edit** (+ **Workers Routes: Edit** if managing routes).
   - `CLOUDFLARE_ACCOUNT_ID` — the account ID (dashboard URL / `wrangler whoami`).
   - *(optional)* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY` to light up client features on the canary.

---

## 7. Remaining manual steps (this environment is NOT CF-authenticated)

The authoring environment runs **node 20** (wrangler needs ≥22) and has **no Cloudflare token**, so the real `wrangler deploy` + probe `curl` could not be run here. To finish the loop, on a machine with node ≥22 + CF auth:

1. Complete §6 steps 1–4 (login, `wrangler secret put` ×3, custom domain, GitHub secrets).
2. Push to `hellno/cloudflare-hosting-state` (or run the workflow via **Actions → cf-web-canary → Run workflow**). Watch the run deploy the worker.
3. **Verify the canary:**
   ```bash
   curl -i https://cf.herocast.xyz/migration-probe   # expect 200, SSR trending + auth evidence panel
   curl -i https://cf.herocast.xyz/providers-probe   # expect 200, provider-tree probe
   ```
4. Once the custom domain resolves, flip `continue-on-error: true → false` on the **"Smoke-check custom domain cf.herocast.xyz"** step so the custom domain is also a hard gate (the live-`workers.dev` smoke is already blocking). Then tick the §2 manual DoD checkbox to close out the unit.

---

## 8. cf-canary acceptance (per `conventions.md`)

`pnpm web:build` green → `pnpm web:serve` (node ≥22) boots locally → push deploys → `cf.herocast.xyz/{migration-probe,providers-probe}` return 200. The live app's `pnpm typecheck` stays 0 (nothing in this unit touches shared TS). Then flip unit #0 → ✅ in `strategy.md`.
