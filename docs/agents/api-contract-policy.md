# API contract policy

## Why this matters

TypeScript types alone cannot validate runtime payloads from upstreams (Neynar, Supabase, Warpcast). A drifted Neynar field surfaces as a `cannot read properties of undefined` in the browser, never at edit time. The OODA harness (see `specs/ooda-harness.md`) closes this gap by making Zod schemas the single source of truth for every new or touched API route: one declaration generates both the runtime validator (`schema.parse(...)`) and the TypeScript type (`z.infer<typeof schema>`).

These schemas are **not** OpenAPI-lite. They are **not** generated from a higher-level spec. They **are** the spec — the source of truth for both wire format and TS type.

## The rule

Every new or touched API route under `app/api/**/route.ts` defines a `requestSchema` and `responseSchema` in `src/lib/api-contracts/<route-name>.ts`. The server uses `requestSchema.safeParse`. The client uses `apiFetch(responseSchema, ...)`. Types come from `z.infer`, never hand-written.

Existing routes are **not** migrated en masse — the policy is opt-in per route. Touch a route, adopt the contract.

## How to apply

The contract file:

```typescript
// src/lib/api-contracts/feeds-following.ts
import { z } from 'zod';

export const requestSchema = z.object({
  fid: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  cursor: z.string().optional(),
});

export const responseSchema = z.object({
  casts: z.array(z.unknown()),
  next: z.object({ cursor: z.string().optional() }).default({}),
});

export type Request = z.infer<typeof requestSchema>;
export type Response = z.infer<typeof responseSchema>;
```

The server:

```typescript
// app/api/feeds/following/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requestSchema, responseSchema } from '@/lib/api-contracts/feeds-following';

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = requestSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid params', details: parsed.error.format() },
      { status: 400 }
    );
  }
  const response = await buildResponse(parsed.data);
  if (process.env.NODE_ENV !== 'production') responseSchema.parse(response);
  return NextResponse.json(response);
}
```

The client:

```typescript
// src/hooks/queries/useFollowingFeed.ts
import { apiFetch } from '@/lib/api-contracts/apiFetch';
import { responseSchema } from '@/lib/api-contracts/feeds-following';

const data = await apiFetch(responseSchema, `/api/feeds/following?${qs}`, {
  perfName: 'feed:following',
});
```

## Common errors → fix

| Code | Action |
|---|---|
| <a id="api-contract-drift"></a>`ApiContractError: validation failed` at runtime | The upstream changed shape, or the schema is wrong. Inspect `error.issues`; update the schema or coerce the upstream value. Do not silence with `.passthrough()` unless the field is truly opaque. |
| <a id="missing-schema"></a>New endpoint with no contract file | Create `src/lib/api-contracts/<route-name>.ts` with `requestSchema`, `responseSchema`, and the two `z.infer` exports. Wire the server and client per the pattern above. |
| <a id="hand-written-type"></a>`Type 'X' is not assignable to inferred 'Response'` | A consumer hand-wrote the response type. Delete it; import `Response` (or rename via `import { Response as Foo }`) from the contract file. |
| <a id="schema-too-strict"></a>Valid request rejected with 400 | Schema is too strict for real traffic. Loosen the failing field (`.optional()`, widen the union). Add a regression test for the shape that broke. |
| <a id="schema-too-loose"></a>Runtime crash downstream of `apiFetch` | Schema accepts shapes that consumers cannot handle. Tighten the failing field; let `apiFetch` reject before the value reaches the consumer. |
| <a id="dev-server-validation"></a>Server returns invalid response in dev only | The dev-only `responseSchema.parse(response)` caught the bug. Fix the route logic so the response matches the schema. |

## Migration policy

- Existing routes keep their current shape until touched. Migration is opportunistic, not bulk.
- "Touched" means: any non-cosmetic edit to `app/api/<route>/route.ts` or its primary consumer.
- When in doubt, add the contract — schemas are cheap and the runtime validation is free in production (`safeParse` is fast; the dev-only `parse` runs once per response).

## See also

- [`app-router-exports.md`](./app-router-exports.md) — contract files live under `src/lib/api-contracts/`, never co-located with `route.ts`.
- [`typecheck.md`](./typecheck.md#ts2322) — TS2322 between a consumer and `Response` means schema/consumer drift.
