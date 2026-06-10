// Barrel for the `next/navigation` adapter (unit #2 navigation seam).
//
// `vite.config.mts` (Area B) aliases `next/navigation` → `@/web/lib/navigation`, so this
// is the single module the 54 live-app call sites and all new `src/web` code resolve to.
// It re-exports exactly the 5 contract APIs that the live app actually imports —
// `useRouter`, `redirect`, `usePathname`, `useSearchParams`, `useParams`.
//
// `notFound`, `permanentRedirect`, `useSelectedLayoutSegment(s)` and the
// `ReadonlyURLSearchParams` type are unused on `main` and intentionally NOT exported
// (add a throwing stub only when a later unit needs one).

// Companion types for `src/web` consumers that want to type a router/search reference.
export type { AppRouterInstance, NavigateOptions } from './actions';
export { redirect, useRouter } from './actions';
export { useParams, usePathname, useSearchParams } from './location';
