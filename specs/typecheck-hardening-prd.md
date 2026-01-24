# Typecheck Hardening & App Router Cleanup PRD

## Overview

The new pre-push `pnpm typecheck` gate is surfacing a large backlog of TypeScript errors that were previously masked by `ignoreBuildErrors`. This PRD defines a phased cleanup plan that keeps changes minimal, unblocks pushes, and improves type safety without overengineering.

## Goals

- Reduce TypeScript errors to zero so `pnpm typecheck` passes.
- Keep runtime behavior unchanged (focus on typing and structure).
- Align App Router modules with Next.js export and prop contracts.
- Improve data model consistency around Farcaster cast IDs and JSON payloads.

## Non-Goals

- No large refactors or feature work.
- No repo-wide reformatting in this effort.
- No deep redesign of stores or database schema.

## Current Problem Summary

`tsc --noEmit` reports errors from:
- App Router module export constraints (`.next/types` errors).
- Page props (Next 15 `searchParams`/`params` typing).
- App Router migration issues (`router.query` use).
- Data model mismatches (cast hashes, account types).
- JSON payload typing in Supabase store code.
- Strict property initialization in entity classes.
- Missing dependency (`react-resizable-panels`).

## Proposed Phases

### Phase 1 — App Router Contract Compliance

**Changes**
- Move non-route exports out of `page.tsx`/`route.ts` modules:
  - `DEFAULT_FILTERS` (search page), `Pricing` (upgrade page), `DM_ERROR_CODES` (route handler).
- Fix `app/oauth/consent/page.tsx` props to match Next 15 PageProps:
  - `searchParams` treated as a Promise and awaited where needed.

**Why this is the right approach**
- Next.js App Router only supports specific exports in `page.tsx` and `route.ts`. Extra exports trigger `OmitWithTag` type failures in `.next/types`. The official docs show only exports like `default`, `generateStaticParams`, `metadata`, and route handlers.
- Next 15 page props are now Promise-based for `params`/`searchParams` in server components.

**Alternatives considered**
- Keep exports in the same file and cast types to `any` — would fight Next’s compiler rules and be brittle.
- Ignore `.next/types` errors — not sustainable with `tsc` gating.

**References**
- Next.js page exports and page prop typing: `https://nextjs.org/docs/app/03-api-reference/03-file-conventions/page`
- Next.js route handler exports: `https://nextjs.org/docs/app/building-your-application/routing/route-handlers`

---

### Phase 2 — App Router Migration Fixes

**Changes**
- Replace `useRouter().query` usage with `useSearchParams` (App Router).
- Fix `next/image` width/height types (use numbers or `fill`).
- Move CSS pseudo selectors (e.g., scrollbar) out of inline style objects.

**Why this is the right approach**
- App Router does not expose `router.query`. `useSearchParams` is the supported API.
- `next/image` expects `width`/`height` as numbers or template literal numbers. `string` width values fail.
- CSS pseudo selectors can’t be expressed in `React.CSSProperties`; they belong in CSS.

**Alternatives considered**
- `as any` casts around router/image/style types — works short-term but hides real type issues.

**References**
- `useSearchParams` API: `https://nextjs.org/docs/app/api-reference/functions/use-search-params`
- `next/image` prop types: `https://nextjs.org/docs/app/api-reference/components/image`
- CSS pseudo selectors (scrollbar) are standard CSS, not inline styles.

---

### Phase 3 — Data Model Normalization (Farcaster)

**Changes**
- Normalize cast hashes to hex strings at boundary layers.
- Add mappers/guards to convert `Uint8Array` → `0x…` hex for UI and stores.
- Narrow `CastWithInteractions` vs `CastToReplyType` at the call sites.

**Why this is the right approach**
- Farcaster SDKs often represent hash as bytes; UI expects string. A single conversion layer avoids repeated casts.

**Alternatives considered**
- Allow unions everywhere (`string | Uint8Array`) — spreads complexity across UI/logic.

**References**
- `bytesToHex` (e.g., viem): `https://viem.sh/docs/utilities/toHex`
- Farcaster hubs utilities: `https://github.com/farcasterxyz/hub-monorepo/blob/main/packages/hub-nodejs/docs/Utils.md`

---

### Phase 4 — Supabase JSON & Store Typing

**Changes**
- Make list/store `contents` types compatible with Supabase `Json`.
- Add minimal helpers (e.g., `asJson`) for explicit casts at insert/update boundaries.
- Align `NotificationStore`/`WorkspaceStore` generics with persisted storage types.

**Why this is the right approach**
- Supabase types use a `Json` union; custom types need to be cast or wrapped to satisfy it.

**Alternatives considered**
- Widen types to `any` globally — hides errors and loses safety.
- Deep rework of generated database types — overkill for now.

**References**
- Supabase TypeScript/Json typing discussion: `https://github.com/orgs/supabase/discussions/32925`
- Supabase type generation: `https://supabase.com/docs/guides/api/rest/generating-types`

---

### Phase 5 — Missing Dependencies & Strict Class Init

**Changes**
- Add missing dependency `react-resizable-panels` (or remove usage if unused).
- Fix strict property initialization in `src/lib/db.ts`, `src/lib/entities/Analytics.ts`:
  - Use constructors, default values, or definite assignment (`!`).

**Why this is the right approach**
- TypeScript strict property initialization is intentional; initialize or assert to avoid runtime undefined.

**References**
- TypeScript strict property initialization: `https://www.typescriptlang.org/tsconfig#strictPropertyInitialization`
- `react-resizable-panels` install: `https://github.com/bvaughn/react-resizable-panels`

---

### Phase 6 — Cleanup & Tightening

**Changes**
- Re-run `pnpm typecheck` after each phase.
- Only after it passes, consider turning `ignoreBuildErrors` to `false`.

**Why this is the right approach**
- Keeps the change set focused and avoids blocking deployment while cleanup is in flight.

## Risks

- Some errors may require small API changes or runtime checks (e.g., nullable data).
- Many errors could be fixed by casting; avoid overuse to preserve real type safety.

## Testing Strategy

- Run `pnpm typecheck` after each phase.
- Spot-check in dev for affected pages/routes (search, upgrade, analytics, lists).
- No E2E needed unless runtime logic is touched.

## Deliverables

- Zero `tsc --noEmit` errors.
- App Router modules conform to Next.js export contracts.
- Standardized Farcaster hash handling.

