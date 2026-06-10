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
- [ ] **(needs you — only the two CF secret *values* are missing)** Set GitHub repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (ready commands in §7) → push → the workflow deploys the worker → the **blocking** `*.workers.dev` smoke returns **200** (both probes 200 with no secrets). Then `wrangler secret put` the runtime keys for real data. The canary lives at its `*.workers.dev` URL; the `cf.herocast.xyz` custom domain is **deferred** — `herocast.xyz` DNS is on Namecheap, not Cloudflare (see §6 Path B). Not runnable from the authoring environment (node 20, no CF token).

**Coexistence guarantee:** this unit touches `.conductor/settings.toml`, `.github/workflows/cf-web-canary.yml`, `wrangler.jsonc` (the **canary's own** config — the custom-domain route is present but **commented out**, so the canary serves on `*.workers.dev` and **no DNS is touched**), `docs/migration/*`, and `strategy.md`'s status cell. Zero changes to any **live-app** file: `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, `package.json`, `vite.config.mts`. The Vercel build graph does not read `wrangler.jsonc`.

---

## 3. Files in / out

| File | Action | Why |
|------|--------|-----|
| `.conductor/settings.toml` | **edit** | Branch-aware Run button (canary on migration branches, live Next app elsewhere); keep the `pnpm rebuild esbuild workerd` setup step. |
| `wrangler.jsonc` | **edit** | The canary's **own** config — carries a **commented-out** `cf.herocast.xyz` custom-domain route (disabled: `herocast.xyz` DNS isn't on Cloudflare). Canary serves on `*.workers.dev`. Not a live-app file; Vercel never reads it. |
| `.worktreeinclude` | unchanged | Already copies `.env*` + `.dev.vars`. |
| `.github/workflows/cf-web-canary.yml` | **new** | Branch-gated auto-deploy of the worker. |
| `docs/migration/phase-2-infra-canary.md` | **new** | This spec + the manual runbook. |
| `docs/migration/strategy.md` | **edit** | Flip unit #0 status → ✅. |

**Reuse (do NOT reinvent):** the `web:*` scripts in `package.json`, `wrangler.jsonc` (worker name/compat), the `cloudflareWorkers` env seam (`src/web/lib/env.server.ts`), and the existing probes. This unit adds *no* application code.

> **Why the Run button is branch-aware.** `.conductor/settings.toml` is shared committed config — it merges to `main` with this unit. A flat `run = "pnpm web:serve"` would repoint **every** contributor's Run button (on `main`) from the live Next dev server to the slower canary build+serve, a real dev-workflow regression. The `case "$(git rev-parse --abbrev-ref HEAD)" in migration/*|*cloudflare*)` guard scopes the canary Run to migration branches only and falls back to the live app (and to the live app on a git failure / detached HEAD), so merging this file to `main` changes nothing for normal work. At cutover (#13) the guard can be dropped once the canary *is* the app.

---

## 4. CI design notes (the footguns this avoids)

- **Branch isolation, two layers.** `on.push.branches: [hellno/cloudflare-hosting-state]` + a job-level `if: github.ref == 'refs/heads/hellno/cloudflare-hosting-state'`. The `if` guard matters because `workflow_dispatch` can be launched against any branch — without it, a manual run from `main` would deploy. With it, the only ref that can reach Cloudflare is the migration branch.
- **No `next build`, no Vercel, no DNS.** The job only runs `vite build` (via `web:build`) + `wrangler deploy`. The Vercel project and the Next build graph are never invoked; with the custom domain disabled, the deploy touches **no DNS at all** — the canary is served on the worker's own `*.workers.dev` hostname.
- **Node 22, deliberately divergent from the live CI.** `build.yaml` pins node 20.12.2 for the Next app; this workflow uses node 22 because wrangler/workerd require it. Independent graphs ⇒ safe.
- **`pnpm rebuild esbuild workerd`** is a discrete step — pnpm v10 skips native postinstall scripts, so without it the build/deploy fails (R3, `phase-1.md §6`).
- **Pinned wrangler.** Deploy runs `pnpm exec wrangler` (the repo-pinned `4.98.0`), not a floating action version, so CI matches local.
- **Least privilege + single-flight.** `permissions: contents: read`; `concurrency` cancels superseded deploys.
- **Runtime vs build secrets.** CI needs ONLY `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. The worker's runtime secrets (`NEYNAR_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set once via `wrangler secret put` and persist on the worker across deploys — they are not in CI. The `VITE_*` build vars are optional repo secrets, inlined at build time.
- **Probe smoke test (blocking).** The deploy step captures the `*.workers.dev` URL wrangler prints; a **blocking** step then curls `/migration-probe` + `/providers-probe` on that live URL expecting 200. Both probes 200 even with NO secrets set (migration-probe renders the empty state; providers-probe is client-rendered), so this gates purely on "did the worker deploy and serve?" — meaningful from the very first deploy, no DNS required. (When `cf.herocast.xyz` is later enabled, re-add a matching custom-domain smoke alongside the `routes` block — §6 Path B.)
- **Honest gating + exit codes.** A `guard` job skips the deploy (neutral, not red) until both CF secrets exist, so pushing before configuring doesn't spam failures. The deploy asserts wrangler's real status via `${PIPESTATUS[0]}` — a `| tee` pipe otherwise masks a failed deploy as success (verified: a tokenless deploy reported "success").

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

> **Name reuse (zero rename).** The server seams fall back `serverEnv('NEYNAR_API_KEY') ?? serverEnv('NEXT_PUBLIC_NEYNAR_API_KEY')` (and the same for `SUPABASE_URL` / `SUPABASE_ANON_KEY`), so the `NEXT_PUBLIC_*` values already in your `.env` work **as-is** — set either the canonical or the `NEXT_PUBLIC_*` name as the worker secret. All `VITE_*` are **optional**: both probes return 200 with zero secrets (migration-probe renders the empty state; providers-probe is client-rendered). Audited in `src/web/lib/{neynar.server.ts, supabase/server.server.ts, analytics.ts}`.

---

## 6. Cloudflare + GitHub setup

`herocast.xyz` DNS is on **Namecheap** (`dns{1,2}.registrar-servers.com` → Vercel), **not Cloudflare**. A Workers `custom_domain` requires the zone active on Cloudflare, so the canary ships on its `*.workers.dev` URL now and `cf.herocast.xyz` is deferred (Path B).

### Path A — ship the canary now (recommended; zero DNS changes)
1. **Mint a Cloudflare API token** (dashboard → My Profile → API Tokens → Create Token). With the custom domain disabled, the deploy needs only **Account → Workers Scripts: Edit** — the built-in **"Edit Cloudflare Workers"** template works as-is (no extra rows). Note the **Account ID** (`wrangler whoami` or the dashboard URL).
2. **Set the two GitHub repo secrets** — the only blockers (ready `gh` commands in §7): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. *(Optional:* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY` — client features; probes 200 without them.)*
3. **Push → first deploy.** The `guard` job passes, CI deploys `herocast-web`, and the blocking `*.workers.dev` smoke confirms 200 — no runtime secrets needed yet.
4. **Runtime secrets — AFTER the worker exists** (chicken-and-egg resolved: deploy first). The seam accepts either name, so your `.env` values work unchanged:
   ```bash
   wrangler secret put NEYNAR_API_KEY      # or NEXT_PUBLIC_NEYNAR_API_KEY
   wrangler secret put SUPABASE_URL        # or NEXT_PUBLIC_SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY   # or NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   They persist on the worker across deploys; CI never needs them.

### Path B — enable `cf.herocast.xyz` later (deliberate; ideally at cutover #13)
A Worker custom domain needs the zone on Cloudflare — a bare CNAME from Namecheap to `*.workers.dev` does **not** work (no cert; Cloudflare returns error 1014). To wire the hostname you move the zone:
1. Cloudflare dashboard → **Add a Site** → `herocast.xyz` → let it scan/import the existing Namecheap records.
2. **Verify the import**, especially the live-app records — apex `herocast.xyz` (`76.76.21.21`) and `www` (`cname.vercel-dns.com`): set them **DNS only (grey cloud)** so Cloudflare just answers DNS and Vercel keeps serving + terminating TLS unchanged. Confirm MX/TXT/etc. came across too.
3. At **Namecheap**, switch the nameservers to the two Cloudflare nameservers shown. Wait for activation (minutes–hours).
4. **Uncomment** the `routes` line in `wrangler.jsonc`; re-mint/extend the API token with **Zone → Workers Routes: Edit + DNS: Edit + Zone: Read** on `herocast.xyz` (on top of Workers Scripts: Edit). Push → `wrangler deploy` provisions `cf.herocast.xyz` + cert automatically; re-add a custom-domain smoke (§4).

> Moving DNS is a real change to the live domain — do it deliberately and verify the Vercel records first. It naturally belongs with cutover (#13), when the app moves to Cloudflare anyway.

---

## 7. What's automated vs. what needs you

**Wired by this unit (no action needed):** the branch-gated CI with a credentials `guard`, build/deploy/blocking-smoke steps, the (disabled) custom-domain route, and `NEXT_PUBLIC_*` env reuse. The authoring environment is node 20 with no CF token, so the live deploy itself could not run here.

**The only thing blocked on you is the two Cloudflare secret VALUES** (the token must be minted; the account ID is yours — `wrangler whoami`). `gh` is authenticated here with admin, so set them with — the value is prompted, never echoed into the shell/transcript:
```bash
gh secret set CLOUDFLARE_API_TOKEN  -R hero-org/herocast   # paste the token at the prompt
gh secret set CLOUDFLARE_ACCOUNT_ID -R hero-org/herocast   # paste the account id
```
For **Path A** the token needs only **Workers Scripts: Edit** (the "Edit Cloudflare Workers" template is enough). Then:
1. Push to `hellno/cloudflare-hosting-state` (or **Actions → cf-web-canary → Run workflow**).
2. The run deploys and the **blocking** smoke verifies `/migration-probe` + `/providers-probe` return 200 on the `*.workers.dev` URL (printed in the deploy log) — that URL is the canary every later unit verifies against.
3. `wrangler secret put` the three runtime keys (§6 Path A step 4) so trending/auth return real data.
4. (Later) wire `cf.herocast.xyz` via §6 Path B.

---

## 8. cf-canary acceptance (per `conventions.md`)

`pnpm web:build` green → `pnpm web:serve` (node ≥22) boots locally → push deploys → the worker's `*.workers.dev` `/{migration-probe,providers-probe}` return 200 (the CI blocking smoke). The live app's `pnpm typecheck` stays 0 (nothing in this unit touches shared TS). Then flip unit #0 → ✅ in `strategy.md`. (`cf.herocast.xyz` acceptance is part of §6 Path B, deferred until DNS moves to Cloudflare.)
