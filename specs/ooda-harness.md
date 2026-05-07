# OODA Harness Spec

## Problem

Agents (and humans) editing this Next.js/TypeScript SaaS frontend break things in ways that only surface in CI, on Vercel preview, or in production. The signal is delayed, unstructured, and tool-specific. The last 65 fix-commits since 2025-09-01 cluster around invisible-at-edit-time failures: App Router export contracts, Supabase JSON↔TS drift, cast-hash format inconsistency, masked TypeScript errors, layer-boundary violations, and contract drift between API routes and their consumers.

The OODA loop (observe → orient → decide → act) is broken: agents act, but never observe their own breakage in time to self-correct.

## Success Criteria

1. **Single aggregator command**: `pnpm check` runs every check in parallel, emits one envelope JSON to stdout, forwards human logs to stderr. Exit code 0 = ok, 1 = errors. Used identically by humans, agents, hooks, and CI.

2. **Structured failure output**: every diagnostic in the envelope carries `{tool, severity, code, file, line, col, message, fix_hint?, see_also?}`. `fix_hint` and `see_also` point an agent to the leaf doc that explains the fix.

3. **Pre-push gate uses the same aggregator**: `pnpm check` (or `pnpm check --fast` on cold cache) replaces today's `pnpm typecheck`. CI replaces today's `pnpm test`-only with `pnpm check`. No special agent path.

4. **Single cross-boundary contract**: API routes that ship in v1 use Zod schemas in `src/lib/api-contracts/` as the single source of truth. Both runtime validation (`schema.parse(body)`) and TS types (`z.infer<typeof schema>`) derive from the same declaration. `apiFetch<schema>(schema, url, init)` wrapper validates fetch responses; parse failure surfaces as `ApiContractError` with `see_also: docs/agents/api-contract-policy.md`.

5. **AGENTS.md exists at repo root** as a tiny index (≤80 lines). `docs/agents/*.md` leaves (≤150 lines each) hold fix-hint content. Errors carry `see_also` anchors pointing to leaves.

6. **Three OODA acceptance scenarios pass**:
   - Typed API drift → envelope returns `API_CONTRACT_DRIFT` with leaf pointer; agent fixes schema, re-runs, ok=true
   - Layer violation (UI imports store) → envelope returns `no-restricted-imports` warning with leaf pointer
   - TypeScript error in changed file → envelope returns `TS2322` with structured location and fix_hint

## Scope

### In Scope (v1, 48h)

- `pnpm check` aggregator script at `scripts/check/index.ts` (tsx, parallel exec)
- Adapters: `tsc.ts`, `biome.ts`, `jest.ts` (no eslint adapter — biome covers lint in v1)
- Fix-hint maps at `scripts/check/hints/<tool>.json`
- `--since=HEAD`, `--json`, `--tools=<list>`, `--fast` flags
- `--fast` drops jest, keeps tsc+biome (escape hatch for cold-cache pre-push)
- Adapter fixture tests (one good run, one error run, snapshot the parsed envelope per tool)
- `AGENTS.md` at repo root (≤80 lines)
- 4 leaf docs: `docs/agents/typecheck.md`, `supabase-json-types.md`, `app-router-exports.md`, `api-contract-policy.md`
- `src/lib/api-contracts/` directory + `apiFetch.ts` helper + 1 reference contract (feeds/following) wired end-to-end
- 2 ESLint `no-restricted-imports` rules (warn-only) with baseline exemptions for known violators (`src/components/ui/sidebar.tsx`, `src/components/ui/toaster.tsx`)
- `pnpm gen:db-types` script wrapping `supabase gen types typescript`
- Pin `@biomejs/biome` to exact `2.3.12` (drop caret)
- Pre-commit hook: unchanged (Biome via lint-staged)
- Pre-push hook: change from `pnpm typecheck` to `pnpm check`
- CI `build.yaml`: replace `pnpm test` with `pnpm check`

### Out of Scope (v1)

- **Visual regression** (any approach) — explicitly cut by user. No Playwright snapshots, no smoke tests, no screenshot artifacts. Revisit only if a visual bug ships to prod that snapshots would have caught.
- **a11y axe-core integration** — defer to v2.
- **`eslint-plugin-boundaries` plugin** — codex showed it would over-fire on existing `src/components/ui/sidebar.tsx` and `toaster.tsx`. Use 2 targeted `no-restricted-imports` rules instead.
- **Provider purity layer rule** — `src/lib/farcaster/providers/index.ts` is React client code; rule banning `next/*` would under-fire. Defer until provider implementations are split from React-context provider code.
- **ESLint adapter in aggregator** — biome covers lint; eslint runs only for layer rules.
- **OpenAPI codegen** — deferred indefinitely. Zod-as-contract satisfies the goal (single source of truth + runtime validation + derived types) for an all-TypeScript consumer set. Promote to OpenAPI only if a non-TS external consumer materializes.
- **Migrating all 30 existing API routes to Zod contracts** — only new/touched routes adopt the pattern. Migration is opportunistic.
- **`tsc-files` for changed-file-only typecheck** — not installed; warps tsconfig project shape; misbehaves on `.next/types/**`. Pre-push runs full `tsc --noEmit` via aggregator.
- **a11y, perf, e2e tests** — out.
- **4 of the originally-planned 8 leaf docs** (`flex-scroll-min-h.md`, `cast-hash-format.md`, `signing-service.md`, `component-layers.md`) — defer until fix-pattern recurs post-v1.

## Constraints

### Must Follow

- **pnpm + lockfile v9** (Node 20.12.2 in CI). Do not switch package manager.
- **Match existing spec template** in `specs/workspace-infrastructure.md`, `specs/farcaster-signing-service.md`. Sections: Problem, Success Criteria, Scope, Constraints, Technical Approach, Edge Cases, Testing Strategy, Implementation Order, Rebuildability Checklist.
- **Aggregator location**: `scripts/check/` (matches existing `scripts/benchmark.ts`, `scripts/lint-supabase-migrations.mjs` convention).
- **Biome pinned exact** (`"@biomejs/biome": "2.3.12"`). Biome JSON reporter is experimental; pinning prevents silent schema drift on patch bumps. Re-run adapter fixtures on every Biome upgrade.
- **`tsc --noEmit --pretty false --noErrorTruncation --locale en`** for stable text parsing. The TypeScript Compiler API is the v2 upgrade path if text parsing proves fragile.
- **Zod schemas as contracts**: every new or touched API route under `app/api/**/route.ts` defines `requestSchema` + `responseSchema` in a sibling file under `src/lib/api-contracts/<route-name>.ts`. Server uses `requestSchema.parse(body)`. Client uses `apiFetch(responseSchema, url, init)`. Types come from `z.infer`, never hand-written.
- **Single envelope shape** — `{version: 1, ok: boolean, duration_ms: number, summary: {errors: number, warnings: number}, diagnostics: Diagnostic[]}`. Stdout = exactly one trailing JSON line. Stderr = raw human-readable per-tool output.
- **`pnpm check --fast`** — escape hatch when full check exceeds budget on cold cache. Drops jest, keeps tsc+biome. Only pre-push has this; CI always runs full.
- **AGENTS.md is the agent-facing index**, not CLAUDE.md (which is human + Claude project context).
- **Existing helper conventions**: `fetchWithPerf` from `@/lib/fetchWithPerf` for perf-tracked calls — `apiFetch` wraps it. Path alias `@/* → src/*`.

### Must Avoid

- **Do NOT** introduce visual regression infrastructure in v1. User explicitly cut this. Document deferral; do not stub the directory.
- **Do NOT** install `tsc-files`, `tsgo`, or any changed-file-only TypeScript runner in v1. Cold-cache cost is paid via `--fast` flag.
- **Do NOT** ship `eslint-plugin-boundaries`. Codex verified the proposed rules over-fire on `src/components/ui/sidebar.tsx` and `toaster.tsx`. Use `no-restricted-imports` with explicit exemption baseline.
- **Do NOT** describe Zod schemas as "OpenAPI-lite" or "generated from spec" — they are the source of truth, period. Documentation in `api-contract-policy.md` must be honest about this.
- **Do NOT** promote layer rules to `error` severity in v1. Warn-only. Promote after 2 weeks of clean baseline.
- **Do NOT** add an ESLint adapter to the aggregator in v1. Biome covers lint; the layer rules surface in IDE + on `pnpm lint` (already in `package.json`).
- **Do NOT** hand-write TS interfaces for >5 endpoints. The whole point of this work.
- **Do NOT** bypass the aggregator with tool-specific shortcuts in CI or hooks. Single source of failure semantics.
- **Do NOT** extend the aggregator with playwright/e2e/visual adapters in v1. Stub the adapter contract; do not add tools.
- **Do NOT** delete `next.config.mjs`'s `ignoreBuildErrors: true` in v1. Removing it is a separate effort tracked in `specs/typecheck-hardening-prd.md`.

## Technical Approach

### Aggregator architecture

```
scripts/check/
├── index.ts                    # entry point, CLI parsing, parallel exec, envelope assembly
├── types.ts                    # Diagnostic, Envelope, Adapter interface
├── adapters/
│   ├── tsc.ts                  # spawns tsc, parses text output
│   ├── biome.ts                # spawns biome, parses --reporter=json
│   └── jest.ts                 # spawns jest, parses --json
├── hints/
│   ├── tsc.json                # { "TS2322": { fix_hint, see_also } }
│   ├── biome.json
│   └── jest.json
└── __fixtures__/               # captured tool outputs
    ├── tsc.error.txt
    ├── tsc.ok.txt
    ├── biome.error.json
    ├── biome.ok.json
    ├── jest.error.json
    └── jest.ok.json
```

CLI surface:
```
pnpm check                       # full
pnpm check --fast                # drop jest (pre-push escape)
pnpm check --json                # envelope only, no human logs to stderr
pnpm check --tools=tsc,biome     # subset
pnpm check --since=HEAD          # incremental hint (passed to biome --staged; tsc still runs full in v1)
```

### Envelope shape

```typescript
// scripts/check/types.ts
export interface Diagnostic {
  tool: 'tsc' | 'biome' | 'jest';
  severity: 'error' | 'warning' | 'info';
  code: string;            // TS2322, lint/correctness/noUnusedImports, etc.
  file?: string;           // absolute or repo-relative
  line?: number;
  col?: number;
  message: string;
  fix_hint?: string;
  see_also?: string;       // docs/agents/<leaf>.md#anchor
}

export interface Envelope {
  version: 1;
  ok: boolean;
  duration_ms: number;
  summary: { errors: number; warnings: number };
  diagnostics: Diagnostic[];
}
```

Stdout: exactly one JSON envelope as the last line. Stderr: pass-through of each tool's human-readable output, prefixed with `[tsc]`, `[biome]`, `[jest]`.

### Per-tool adapter contracts

Each adapter exports:
```typescript
interface Adapter {
  name: 'tsc' | 'biome' | 'jest';
  run(opts: { fast: boolean; cwd: string }): Promise<{
    diagnostics: Diagnostic[];
    rawStderr: string;  // forwarded to aggregator stderr
  }>;
}
```

Adapter implementations:

- **tsc** (`adapters/tsc.ts`): spawns `tsc --noEmit --pretty false --noErrorTruncation --locale en` from project root. Parses stderr lines matching `^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+): (?<message>.*)$`. Maps `code` → fix_hint via `hints/tsc.json`.
- **biome** (`adapters/biome.ts`): spawns `biome check . --reporter=json`. Parses JSON; map each `diagnostics[].category` → fix_hint via `hints/biome.json`. Pin biome version exactly to mitigate experimental-reporter drift.
- **jest** (`adapters/jest.ts`): spawns `jest --json --silent`. Parses `testResults[].testResults[]` failures; extract first stack frame matching repo paths for `file/line/col`.

### `--fast` semantics

- Default `pnpm check`: tsc + biome + jest in parallel
- `pnpm check --fast`: tsc + biome only. Used in `.husky/pre-push` when the full run is too slow on cold cache. CI always runs full (no `--fast`).

### API contract layer

```
src/lib/api-contracts/
├── index.ts                # re-exports
├── apiFetch.ts             # typed fetch wrapper; wraps fetchWithPerf
├── errors.ts               # ApiContractError
└── feeds-following.ts      # reference: requestSchema, responseSchema, types
```

Pattern (reference shows the rule):
```typescript
// src/lib/api-contracts/feeds-following.ts
import { z } from 'zod';

export const followingFeedRequestSchema = z.object({
  fid: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  cursor: z.string().optional(),
});

export const followingFeedResponseSchema = z.object({
  casts: z.array(z.unknown()),  // existing FarcasterCast type used outside the contract
  next: z.object({ cursor: z.string().optional() }).default({}),
});

export type FollowingFeedRequest = z.infer<typeof followingFeedRequestSchema>;
export type FollowingFeedResponse = z.infer<typeof followingFeedResponseSchema>;
```

```typescript
// app/api/feeds/following/route.ts (modified)
import { followingFeedRequestSchema, followingFeedResponseSchema } from '@/lib/api-contracts/feeds-following';

export async function GET(request: NextRequest) {
  const parsed = followingFeedRequestSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', details: parsed.error.format() }, { status: 400 });
  }
  // ... existing logic ...
  const response = { casts, next };
  // dev-only validation; in prod this is a no-op behind NODE_ENV check
  if (process.env.NODE_ENV !== 'production') followingFeedResponseSchema.parse(response);
  return NextResponse.json(response);
}
```

```typescript
// src/lib/api-contracts/apiFetch.ts
import { z } from 'zod';
import { fetchWithPerf } from '@/lib/fetchWithPerf';
import { ApiContractError } from './errors';

export async function apiFetch<S extends z.ZodTypeAny>(
  schema: S,
  url: string,
  init?: RequestInit & { perfName?: string }
): Promise<z.infer<S>> {
  const res = await fetchWithPerf(url, init, { name: init?.perfName ?? `api:${url}` });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiContractError({
      url,
      issues: parsed.error.issues,
      see_also: 'docs/agents/api-contract-policy.md',
    });
  }
  return parsed.data;
}
```

### AGENTS.md (root, ≤80 lines)

```markdown
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
```

### Leaf doc shape (each ≤150 lines)

```markdown
# <Topic>

## Why this matters
2-3 sentences with a prior commit reference.

## The rule
One sentence.

## How to apply
Concrete code/pattern, ≤30 lines.

## Common errors → fix
| Code | Action |
|---|---|

## See also
Cross-links.
```

### ESLint layer rules

```jsonc
// .eslintrc.json (modify existing)
{
  "rules": {
    // existing rules unchanged
    "no-restricted-imports": ["warn", {
      "patterns": [
        { "group": ["@/stores/*", "@/stores"], "message": "UI primitives (src/components/ui) must not import stores. Lift state to src/common/components." }
      ]
    }]
  },
  "overrides": [
    {
      "files": ["src/stores/**/*.{ts,tsx}"],
      "rules": {
        "no-restricted-imports": ["warn", {
          "patterns": [
            { "group": ["@/components/*", "@/common/components/*", "next/*"], "message": "Stores must not import UI components or Next.js internals." }
          ]
        }]
      }
    },
    {
      "files": ["src/components/ui/sidebar.tsx", "src/components/ui/toaster.tsx"],
      "rules": { "no-restricted-imports": "off" }
    }
  ]
}
```

The first rule scopes to `src/components/ui/**` via `.eslintrc.json` overrides (TBD final form during implementation — pattern matches the existing structure).

### Hooks

```sh
# .husky/pre-push (modified)
$PNPM_CMD check
```

```jsonc
// package.json (lint-staged unchanged from today)
"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["biome check --write --no-errors-on-unmatched"],
  "*.{json,md}": ["biome format --write --no-errors-on-unmatched"]
}
```

### CI

```yaml
# .github/workflows/build.yaml (modify "Run tests" step)
- name: Run checks
  run: pnpm check
```

### Key Files

**New:**
- `scripts/check/index.ts`
- `scripts/check/types.ts`
- `scripts/check/adapters/{tsc,biome,jest}.ts`
- `scripts/check/hints/{tsc,biome,jest}.json`
- `scripts/check/__fixtures__/*` and `scripts/check/__tests__/*.test.ts`
- `src/lib/api-contracts/{index,apiFetch,errors,feeds-following}.ts`
- `AGENTS.md`
- `docs/agents/{typecheck,supabase-json-types,app-router-exports,api-contract-policy}.md`

**Modified:**
- `package.json` — pin `@biomejs/biome` to `2.3.12`, add `check`, `check:fast`, `gen:db-types` scripts, optionally `dev` deps for tsx if missing (already present)
- `app/api/feeds/following/route.ts` — adopt `followingFeedRequestSchema`/`responseSchema`
- `src/hooks/queries/useFollowingFeed.ts` — call `apiFetch(followingFeedResponseSchema, ...)` via the provider
- `src/lib/farcaster/providers/neynar.ts` — only if direct fetch is replaced; otherwise contract is enforced one layer above
- `.husky/pre-push` — run `pnpm check`
- `.github/workflows/build.yaml` — run `pnpm check`
- `.eslintrc.json` — add `no-restricted-imports` rules + baseline exemptions

### Existing Code to Leverage

- `fetchWithPerf` from `src/lib/fetchWithPerf.ts` — `apiFetch` wraps it, preserving perf telemetry
- `usePerformanceStore` and tracking helpers — already capture slow ops; new contract errors get logged via existing channels
- `database.types.ts` (already generated via `supabase gen types typescript`) — wrap regeneration in `pnpm gen:db-types`
- `@neynar/nodejs-sdk` types — referenced inside Zod schemas as `z.unknown()` for now; tighten only if cast shape stabilizes
- `src/lib/farcaster/providers/types.ts` — provider interface is the natural seam where API contracts apply
- Existing zod usage via `@hookform/resolvers/zod` and `supabase/functions/farcaster-signer/lib/validate.ts` — same library, same patterns

## Edge Cases

1. **Aggregator: one tool crashes** — adapter returns `{diagnostics: [{tool, severity:'error', code:'TOOL_CRASH', message: e.message}], rawStderr: e.stack}`. Aggregator continues. Envelope shows `ok: false`.
2. **Aggregator: tool produces no parseable output** — adapter returns empty diagnostics + raw stderr. If exit code != 0, synthesize one diagnostic `{code:'UNKNOWN_FAILURE', message: 'Tool exited non-zero with no parseable diagnostics; see stderr'}`.
3. **Biome JSON reporter schema drift on minor bump** — adapter fixture tests fail in CI. Bump is rolled back; we update the adapter and re-pin.
4. **Cold tsc cache after branch switch** — full `pnpm check` exceeds 60s. Pre-push uses `pnpm check --fast` (drops jest), CI runs full and is the backstop.
5. **`apiFetch` parse failure in production** — `ApiContractError` thrown; React Query treats as a query error; UI surfaces "Something went wrong"; Sentry captures the structured `issues` array. Dev: `responseSchema.parse(response)` runs in the route too, so server-side validation catches it before the client.
6. **Existing route not migrated to Zod** — agents see no contract enforcement; contract is opt-in for new/touched routes only. Document this explicitly in `api-contract-policy.md`.
7. **Layer rule warning fires on a deliberate exception** — add the file to the exemption override in `.eslintrc.json`. Document in commit message.
8. **`pnpm check` emits >1MB envelope (large failure batch)** — pipe stdout to file: `pnpm check --json > .context/check-result.json`. Document in `AGENTS.md`.
9. **Agent runs `pnpm check` mid-edit on broken file** — adapter still emits structured output; that's the point. No special handling.
10. **`AGENTS.md` and `CLAUDE.md` diverge** — `AGENTS.md` is the agent-facing index pointing at leaves; `CLAUDE.md` is the human + Claude-project context. They reference each other. Keep AGENTS.md ≤80 lines so it's cheap context.

## Testing Strategy

### Unit / fixture tests

`scripts/check/__tests__/adapters.test.ts`:
```typescript
describe('tsc adapter', () => {
  it('parses single error with file/line/col', () => {
    const out = parseTscOutput(readFixture('tsc.error.txt'));
    expect(out.diagnostics[0]).toMatchObject({ tool: 'tsc', code: 'TS2322', file: expect.any(String), line: expect.any(Number) });
  });
  it('returns empty diagnostics on clean output', () => {
    expect(parseTscOutput(readFixture('tsc.ok.txt')).diagnostics).toEqual([]);
  });
});
// Same shape for biome and jest adapters.
```

### Integration smoke

`scripts/check/__tests__/integration.test.ts` runs `pnpm check --tools=biome` against a tiny fixture project (a temp dir with one bad file). Asserts envelope shape, exit code, stderr forwarding.

### Acceptance scenarios (manual + repeatable)

Three scenarios from §9 of `.context/ooda-harness-spec-input.md`:

1. **Typed API drift**: edit `app/api/feeds/following/route.ts` to return an extra field, do not update `followingFeedResponseSchema`. Run `pnpm check`. Assert envelope contains `{tool:'jest', code:'API_CONTRACT_DRIFT'}` (or `tsc` if the type widens). Verify `see_also` resolves.
2. **Layer violation**: add `import { useUserStore } from '@/stores/useUserStore'` to `src/components/ui/button.tsx`. Run `pnpm lint` (since lint isn't in v1 aggregator). Assert warning fires; CI does not fail (warn-only). Confirm exempted files don't fire.
3. **TypeScript error**: introduce `let x: string = 5;` in any covered file. Run `pnpm check`. Assert envelope contains `{tool:'tsc', code:'TS2322', file, line, col, fix_hint}`.

### Manual rollout test

Run `pnpm check` on a clean checkout of `main`. Assert `ok: true`. Time it. Document the warm-cache duration in `docs/agents/typecheck.md`.

### Test location

- Aggregator tests: `scripts/check/__tests__/` (Jest picks them up; `jest.config.js` already covers all `**/*.test.ts` outside `supabase/functions/`).
- Reference contract test: `src/lib/api-contracts/__tests__/feeds-following.test.ts` (asserts schemas accept valid + reject invalid shapes).

## Implementation Order

1. **Hour 0–2**: Scaffold `scripts/check/{index,types}.ts`, install no new deps (tsx, jest already present). Wire `pnpm check` script, define envelope and Adapter contract.
2. **Hour 2–6**: Build adapters in this order — biome (easiest, native JSON), tsc (text parser), jest (native JSON). Capture fixtures by running each tool against contrived bad files. Write `__tests__/adapters.test.ts`.
3. **Hour 6–8**: Hint maps for the 10–15 most common diagnostic codes from each tool (mined from the §4 failure-mode evidence in `.context/ooda-harness-spec-input.md`).
4. **Hour 8–10**: Implement `--fast`, `--json`, `--tools=`. Run `pnpm check` against the live repo, fix any adapter bugs surfaced.
5. **Hour 10–12**: Pin Biome `2.3.12`, swap `.husky/pre-push` to `pnpm check`, swap CI `pnpm test` → `pnpm check`. Verify CI green.
6. **Hour 12–16**: Write `AGENTS.md` and 4 leaf docs. Each leaf must reference a real prior fix-commit as evidence (mine from `.context/ooda-harness-spec-input.md` §4).
7. **Hour 16–22**: Build `src/lib/api-contracts/` — `apiFetch`, `errors`, reference `feeds-following.ts`. Migrate `app/api/feeds/following/route.ts` to use `requestSchema`. Wire `useFollowingFeed` to `apiFetch(responseSchema, ...)` via the provider.
8. **Hour 22–26**: Add 2 `no-restricted-imports` rules + exemption baseline to `.eslintrc.json`. Run `pnpm lint`; baseline any unexpected violations.
9. **Hour 26–30**: Add `pnpm gen:db-types` script. Run; verify regenerated `database.types.ts` matches current.
10. **Hour 30–36**: Run all three acceptance scenarios. Iterate until each produces the expected envelope.
11. **Hour 36–40**: Buffer for adapter quirks, fix-hint coverage, documentation polish.
12. **Hour 40–48**: Code review against this spec. Open PR. Update `CLAUDE.md` with one paragraph pointer to `AGENTS.md`.

## Failed Approaches

- **OpenAPI codegen for 6 endpoints** (codex's mitigation for the literal "generated" reading): rejected because every consumer in v1 is TypeScript. The OpenAPI spec would be a hand-written YAML translated to TypeScript types we already had hand-written — same ergonomics, more toolchain. Promote only when a non-TS external client materializes.
- **`eslint-plugin-boundaries` with declarative element types**: rejected. Codex grep'd the codebase and found `src/components/ui/sidebar.tsx` and `toaster.tsx` already import hooks; rule would warning-flood on day one. `no-restricted-imports` with explicit baseline exemptions is more honest.
- **Playwright committed snapshots in Docker**: rejected. User cut visual regression entirely; Mac-dev/Linux-CI font drift would have made the workflow ritualistic anyway.
- **`tsc-files` for changed-file-only typecheck**: rejected. Not installed; warps tsconfig project shape via temp `files:` injection; misbehaves on `.next/types/**`. Cold-cache cost is paid via `--fast` instead.
- **Compiler-API-based tsc adapter in v1**: deferred. Text parsing with stable flags is simpler for the 48h budget. CompilerAPI is the v2 upgrade path if text parsing breaks.

## Open Questions

- **Reference route choice**: `feeds/following` chosen as the canary (cleanest shape, exercises Neynar drift). Alternatives (`casts`, `lists`) considered. Lock in during implementation.
- **CI `--fast` policy**: v1 says CI always runs full. If CI runtime exceeds 5 min on average PR, revisit.
- **`apiFetch` perf-tracking name auto-derivation**: derive from URL or require explicit `perfName`? Default to URL; override via opt-in. Lock in during implementation.

## Rebuildability Checklist

- [x] Problem statement clear, evidence-cited
- [x] Success criteria concrete and testable
- [x] In/Out scope explicit with reasons
- [x] Constraints reference actual files (`scripts/`, `src/lib/api-contracts/`, `.eslintrc.json`, `.husky/pre-push`, `.github/workflows/build.yaml`)
- [x] Anti-patterns explicit (visual regression, OpenAPI v1, `tsc-files`, boundaries plugin, error-severity layer rules)
- [x] Existing code-to-reuse identified (`fetchWithPerf`, `database.types.ts`, provider interface, existing Zod via auth/forms)
- [x] Adversarial review folded in (codex feedback in `.context/ooda-harness-spec-input.md` §12)
- [x] Implementation order with hour estimates totaling 48h with buffer
- [x] Three acceptance scenarios for OODA loop closure
- [x] Edge cases enumerated (10)
- [x] Failed approaches documented with reasons
- [x] Open questions narrow and non-blocking
