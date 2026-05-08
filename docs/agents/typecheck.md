# TypeScript errors

## Why this matters

`next.config.mjs` sets `typescript.ignoreBuildErrors: true` (line 78), so TS errors do **not** break `next build` or block Vercel deploys. They surface only via `tsc --noEmit`, which is what `pnpm check` runs. Without the envelope, an agent can ship a broken type contract and never see it. Recent example: commit `fed6a8e4` (`fix: resolve high-risk TypeScript errors`) — accumulated drift only visible once someone ran tsc directly.

## The rule

Run `pnpm check` after any edit that touches types, function signatures, store shape, or API response shapes. Treat any `tool: 'tsc'` diagnostic in the envelope as blocking, regardless of build status.

## How to apply

The envelope reports one diagnostic per TS error:

```json
{
  "tool": "tsc",
  "severity": "error",
  "code": "TS2322",
  "file": "src/common/components/CastRow.tsx",
  "line": 142,
  "col": 9,
  "message": "Type 'string | undefined' is not assignable to type 'string'.",
  "fix_hint": "Narrow with a guard or default the value before assignment.",
  "see_also": "docs/agents/typecheck.md#ts2322"
}
```

Open the file at the reported line, narrow the value (`if (x) { ... }`, `?? ''`, `as` only when truly unavoidable), then re-run `pnpm check` to confirm `ok: true`.

## Common errors → fix

| Code | Action |
|---|---|
| <a id="ts2322"></a>**TS2322** — Type X not assignable to type Y | Narrow with a guard, default with `??`, or widen the target type. Avoid `as` casts unless the runtime invariant is enforced elsewhere. |
| <a id="ts2339"></a>**TS2339** — Property does not exist on type | The object is typed narrower than you expect. Either widen the type, narrow with `in` / `typeof`, or fix the upstream type definition. |
| <a id="ts2304"></a>**TS2304** — Cannot find name | Missing import. Add the import; if the symbol is from a generated file (e.g., `database.types.ts`), regen via `pnpm gen:db-types`. |
| <a id="ts2345"></a>**TS2345** — Argument type mismatch | Caller is passing the wrong shape. Adjust the call site or update the parameter type if the new shape is correct. |
| <a id="ts7006"></a>**TS7006** — Parameter implicitly has an `any` type | Annotate the parameter. For callbacks, infer from the surrounding function type rather than re-typing manually. |
| <a id="ts2554"></a>**TS2554** — Expected N arguments, got M | Function signature changed. Update all call sites, or add an optional parameter with a default if backward-compat matters. |
| <a id="ts18048"></a>**TS18048** — Value is possibly `undefined` | Add a guard (`if (!x) return ...`), use optional chaining (`x?.foo`), or default (`x ?? fallback`). Do not silence with `!`. |
| <a id="ts18047"></a>**TS18047** — Value is possibly `null` | Guard with a null check or use optional chaining. Same playbook as TS18048. |
| <a id="ts2741"></a>**TS2741** — Property missing in type | A required field is absent. Add it to the object literal, or mark it optional in the type if truly optional. |
| <a id="ts2769"></a>**TS2769** — No overload matches this call | Inspect the overload list; pass the correct discriminator or fix argument shape. |
| <a id="ts2538"></a>**TS2538** — Type cannot be used as an index type | Constrain the key to `string \| number \| symbol`; narrow before indexing. |
| <a id="ts2786"></a>**TS2786** — Cannot be used as a JSX component | Check the component's return type and named/default export shape. |
| <a id="ts2353"></a>**TS2353** — Object literal may only specify known properties | Remove the unexpected key, or extend the target type if the field is real. |
| <a id="ts2532"></a>**TS2532** — Object is possibly undefined | Use optional chaining or add a guard before access. |
| <a id="ts2305"></a>**TS2305** — Module has no exported member | Check the import path and verify the module's exports. |

## Biome diagnostics

### biome-format
Formatting issue. Run `pnpm format` or `biome check --write` to auto-fix.

### biome-parse
Parse error. Fix the syntax before linting can proceed.

### biome-unused-imports
Remove the unused import or use it. Auto-fixable via `biome check --write`.

### biome-unused-vars
Remove the unused variable, prefix with `_` if intentionally unused, or use it.

### biome-exhaustive-deps
Add the missing dependency to the React hook deps array, or document why it is intentionally omitted.

### biome-hook-top-level
React hooks must be called at the top level. Move out of conditional/loop.

### biome-use-template
Use template literals instead of string concatenation.

### biome-node-protocol
Use `node:` protocol for built-in module imports (e.g. `import fs from 'node:fs'`).

### biome-non-null
Avoid `!` non-null assertions; replace with explicit guards or type narrowing.

### biome-no-any
Replace `any` with `unknown` or a more specific type.

### biome-array-index-key
Use a stable identifier as the React `key`, not an array index.

### biome-no-console
Remove or replace `console.log` with the project logger.

### biome-useless-fragment
Remove the redundant React Fragment.

### biome-alt-text
Add a meaningful `alt` attribute to `<img>` (or `alt=""` for decorative images).

## Jest failures

### jest-test-failure
A test assertion failed. Inspect the failure message; fix the implementation or update the test if the new behavior is intentional.

### jest-suite-failure
A suite failed to load (syntax error, missing import, or module resolution). Fix the load failure before tests can run.

### jest-timeout
Test exceeded its timeout. Bump `jest.setTimeout`, mock slow dependencies, or fix the underlying hang.

### jest-snapshot
Snapshot mismatch. If the change is intentional, update with `pnpm jest -u`.

### jest-unhandled-rejection
Unhandled promise rejection in test. Await the promise or wrap with `.rejects` matchers.

## Aggregator failures

### tool-crash
The adapter wrapped a tool that crashed before producing parseable output. Read raw stderr (forwarded by the aggregator) for the stack trace; common causes are bad config files or missing binaries.

### unknown-failure
The tool exited non-zero with no parseable diagnostics. Inspect raw stderr; if the tool is healthy, the adapter parser may need a fix.

## Reading the envelope at scale

A failed `pnpm check` may emit dozens of diagnostics. Pipe to a file when stdout exceeds a few hundred lines:

```bash
pnpm check --json > .context/check-result.json
```

Then read `diagnostics[].see_also` and group fixes by leaf. Most TS errors collapse into a handful of root causes; fix the root, then re-run.

## See also

- [`app-router-exports.md`](./app-router-exports.md) — TS errors in `route.ts` files often mean a disallowed export, not a real type bug.
- [`api-contract-policy.md`](./api-contract-policy.md) — schema drift surfaces as TS2322/TS2741 between the inferred contract type and the consumer.
- [`supabase-json-types.md`](./supabase-json-types.md) — TS errors involving `Json` columns mean the schema changed; regen.
