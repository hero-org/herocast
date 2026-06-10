// Drop-in `next/navigation` adapter — the read half (pathname / search params / route
// params), backed by @tanstack/react-router. See `actions.ts` for the seam/alias rationale.
import { useLocation, useParams as useTanStackParams } from '@tanstack/react-router';
import { useMemo } from 'react';

// TanStack's `useParams` option + return types are keyed off the registered route tree;
// Next's hook is route-agnostic. Read it through a loosened, still-`use`-prefixed view
// (so rules-of-hooks holds) that mirrors the Next `Record<string, string | string[]>`
// contract — catch-all/splat segments arrive as arrays.
const useRouteParams = useTanStackParams as unknown as (opts: { strict: false }) => Record<string, string | string[]>;

/**
 * Drop-in for `next/navigation` `usePathname()`. Returns the current pathname (leading
 * slash, no search/hash), sourced from TanStack's parsed location.
 */
export function usePathname(): string {
  return useLocation().pathname;
}

/**
 * Drop-in for `next/navigation` `useSearchParams()`. Next returns a
 * `ReadonlyURLSearchParams`; we return a plain `URLSearchParams` built from TanStack's
 * `location.searchStr` — structurally a superset (exposes `.get/.getAll/.has/.entries/
 * .keys/.values/.forEach/.toString`), so the live call sites work unchanged. The
 * `searchStr` carries a leading `?`, which the `URLSearchParams` constructor strips.
 *
 * Memoized on `searchStr` so the instance is stable across renders with the same query
 * (matching the referential stability the live app relies on for effect deps).
 *
 * For NEW `src/web` routes, prefer TanStack's typed `useSearch` + route `validateSearch`
 * instead of this string-bag adapter — do not force-rewrite shared components (spec policy).
 */
export function useSearchParams(): URLSearchParams {
  const searchStr = useLocation().searchStr;
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

/**
 * Drop-in for `next/navigation` `useParams()`. Returns the current route's dynamic
 * params as a `Record<string, string | string[]>` (catch-all segments are arrays).
 * `strict: false` lets it be called from any subtree without binding to a specific route,
 * matching Next's context-free hook. Generic param mirrors Next's `useParams<T>()` so
 * call sites that annotate their shape (e.g. `useParams<{ slug: string }>()`) compile.
 */
export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T {
  return useRouteParams({ strict: false }) as T;
}
