# AGENTS.md

You are an agent in this repo. Run `pnpm check` after every meaningful edit. Read the JSON envelope on stdout. For each diagnostic with `see_also`, follow the link to a leaf doc and apply the fix.

## Tool surface
- `pnpm check`         → all checks, JSON envelope to stdout, raw to stderr
- `pnpm check --json`  → JSON envelope only (suppresses stderr from tools)
- `pnpm check --fast`  → tsc + biome only (skips jest); pre-push escape only
- `pnpm test`          → jest only
- `pnpm typecheck`     → tsc only
- `pnpm lint`          → biome + next lint

## Architecture leaves
- API contracts → `docs/agents/api-contract-policy.md`
- App Router exports → `docs/agents/app-router-exports.md`
- Supabase JSON ↔ TS → `docs/agents/supabase-json-types.md`
- TypeScript errors → `docs/agents/typecheck.md`

## Process
- Pre-commit: Biome via lint-staged (changed files)
- Pre-push: `pnpm check` (or `--fast` on cold cache)
- CI: `pnpm check`

## Working with the envelope

Stdout emits one JSON line: `{version, ok, duration_ms, summary, diagnostics: [{tool, severity, code, file, line, col, message, fix_hint?, see_also?}]}`. If `ok:false`, walk diagnostics; for each `see_also`, read that leaf and apply the fix; rerun `pnpm check`.

For large failure batches: `pnpm check --json > .context/check-result.json` then read selectively.

To get a clean envelope, invoke directly via `npx tsx scripts/check/index.ts --json`. When invoked through `pnpm check`, pnpm wraps stdout with a header (`> herocast@... check ...`) and trailing `ELIFECYCLE` on non-zero exit; extract with `pnpm check --json 2>/dev/null | grep '^{"version":1' | head -1`.

See `CLAUDE.md` for human-facing project context.
