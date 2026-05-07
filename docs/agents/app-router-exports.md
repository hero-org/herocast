# Next.js App Router exports

## Why this matters

The Next.js App Router enforces a strict export contract on `app/**/route.ts` and `app/**/page.tsx` files. Helper exports, default exports in route files, or the wrong method name silently break the build (or, with `ignoreBuildErrors: true`, break only at request time). Recent evidence: `35f2641e` (`Fix/649 conversation page and app router migration`) and `2eb03614` (`fix: resolve conversation page issues and complete App Router migration`) — App Router migration cleanup.

## The rule

Files under `app/**/route.ts` may only export the HTTP method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) plus the allow-listed config keys (`runtime`, `dynamic`, `revalidate`, `maxDuration`, `fetchCache`, `dynamicParams`, `preferredRegion`). Files under `app/**/page.tsx` export a default React component plus optional `metadata` or `generateMetadata`.

## How to apply

A canonical route handler:

```typescript
// app/api/feeds/following/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFollowing } from '@/lib/feeds/fetchFollowing';

export const maxDuration = 20;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await fetchFollowing(searchParams);
  return NextResponse.json(data);
}
```

Helpers live in a sibling file outside `app/`:

```typescript
// src/lib/feeds/fetchFollowing.ts
export async function fetchFollowing(params: URLSearchParams) {
  // ...
}
```

A canonical page:

```typescript
// app/(app)/feeds/page.tsx
import type { Metadata } from 'next';
import { FeedsView } from '@/common/components/FeedsView';

export const metadata: Metadata = { title: 'Feeds' };

export default function FeedsPage() {
  return <FeedsView />;
}
```

## Common errors → fix

| Code | Action |
|---|---|
| <a id="route-bad-export"></a>`Type 'X' is not assignable to type 'RouteHandler'` | The exported name is not a recognized HTTP method. Rename to `GET`/`POST`/etc., or move the function to `src/lib/...` if it is a helper. |
| <a id="route-default-export"></a>Build fails on `default export` in `route.ts` | `route.ts` files cannot have a default export. Move the component to `page.tsx` or export the function under an HTTP method name. |
| <a id="page-named-export"></a>Page does not render after edit | `page.tsx` must export a default component. A named export is silently ignored. |
| <a id="route-helper-export"></a>Build error on a helper exported from `route.ts` | Co-located helpers break the contract. Move helpers to a sibling under `src/lib/` and import from the route. |
| <a id="dynamic-typo"></a>`Type 'string' is not assignable to type 'auto' \| 'force-dynamic' \| 'error' \| 'force-static'` | `dynamic` only accepts those literals. Use `as const` or correct the value. |
| <a id="metadata-shape"></a>TS error on `metadata` in `page.tsx` | `metadata` must conform to `Metadata` from `next`. Import the type and annotate. |
| <a id="max-duration"></a>Vercel timeout | Add `export const maxDuration = N;` (seconds). Default is 10s on Hobby; bump for slow upstreams (Neynar 7-8s) — see `CLAUDE.md`. |

## Allowed exports cheatsheet

| File | Allowed exports |
|---|---|
| `app/**/route.ts` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `runtime`, `dynamic`, `revalidate`, `maxDuration`, `fetchCache`, `dynamicParams`, `preferredRegion` |
| `app/**/page.tsx` | `default`, `metadata`, `generateMetadata`, `revalidate`, `dynamic`, `dynamicParams`, `fetchCache`, `runtime`, `preferredRegion` |
| `app/**/layout.tsx` | `default`, `metadata`, `generateMetadata`, plus the same config keys as `page.tsx` |
| `app/**/loading.tsx`, `error.tsx`, `not-found.tsx` | `default` only |

## See also

- [`api-contract-policy.md`](./api-contract-policy.md) — request/response shapes for `route.ts` files live in `src/lib/api-contracts/`, not co-located.
- [`typecheck.md`](./typecheck.md#ts2322) — TS errors in `route.ts` files often mean the wrong export, not a real type mismatch.
