# Supabase JSON ↔ TS

## Why this matters

`src/common/types/database.types.ts` is **auto-generated** from the live Postgres schema via `supabase gen types typescript`. JSON columns surface as the opaque `Json` type, so consumers must narrow at the boundary or TS will accept invalid shapes. When the schema and the file drift (a migration ships, types are not regenerated), every consumer that reads/writes that table starts lying about its shape. Recent evidence: `95433055` (`chore: regenerate supabase database types`) and `c0ea5a31` (`fix: align list/store types with supabase json`).

## The rule

Run `pnpm gen:db-types` after every migration that touches column types. Never hand-edit `src/common/types/database.types.ts`. Narrow `Json` at the read boundary with a Zod schema, never by casting.

## How to apply

After a migration:

```bash
pnpm gen:db-types
pnpm check
git add src/common/types/database.types.ts
```

Narrow a `Json` column with Zod at the read site:

```typescript
import { z } from 'zod';
import type { Database } from '@/common/types/database.types';

// JSON column in the table definition
type ListContentRow = Database['public']['Tables']['list']['Row']['contents'];

// Per-list schema for the variant we expect at this boundary
const fidListContentSchema = z.object({
  type: z.literal('fids'),
  fids: z.array(z.number().int().positive()),
});

export function readFidList(row: { contents: ListContentRow }) {
  return fidListContentSchema.parse(row.contents);
}
```

Write paths follow the same pattern in reverse: build the value via the schema (`schema.parse(value)`) so an invalid shape blows up before it hits the database.

## Common errors → fix

| Code | Action |
|---|---|
| <a id="json-incompatible"></a>**TS2322** — `Type 'X' is not assignable to type 'Json'` | The shape contains a non-JSON value (Date, undefined, function). Serialize to JSON-safe primitives first. |
| <a id="json-missing-narrow"></a>**TS2339** — `Property 'x' does not exist on type 'Json'` | You are reading a JSON column without narrowing. Add a Zod schema and `parse` at the boundary. |
| <a id="schema-drift"></a>**TS2741** / **TS2554** after a migration | `database.types.ts` is stale. Run `pnpm gen:db-types`. Diff against the migration to confirm shapes match. |
| <a id="missing-column"></a>**TS2339** on a column you just added | Same: regen. The generated file is the source of truth for column existence. |
| <a id="hand-edit"></a>Drift reappears on every regen | Someone hand-edited `database.types.ts`. `git checkout` the file and regen — never patch it. |

## Detecting drift

If you suspect drift, compare the generated file against migrations:

```bash
git diff HEAD -- src/common/types/database.types.ts
git log --oneline -- supabase/migrations | head -5
```

A migration without a corresponding `database.types.ts` change is a smell. Re-run `pnpm gen:db-types`.

## See also

- [`api-contract-policy.md`](./api-contract-policy.md) — Zod schemas applied to `Json` columns follow the same pattern as Zod schemas for API request/response.
- [`typecheck.md`](./typecheck.md) — TS errors that mention `Json` almost always mean missing narrowing or stale generated types.
