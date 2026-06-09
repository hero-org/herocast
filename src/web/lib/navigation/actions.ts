// Drop-in `next/navigation` adapter — the imperative half (router actions + redirect),
// backed by @tanstack/react-router. Unit #2 (navigation seam) aliases `next/navigation`
// → `@/web/lib/navigation` in the TanStack vite build only (Area B), so the live-app call
// sites resolve to *real* Next under `next build` and to this under `vite build` — zero
// edits to shared files. New `src/web` code imports `@/web/lib/navigation` directly.
//
// Adapted from the dead `app/router-compat-full.ts` (do NOT import it). That file modeled
// the Pages-Router `next/router` (Promise<boolean> push/replace + a router-events bus);
// the live app uses the App Router `next/navigation` surface, whose methods are
// fire-and-forget (`void`). We implement exactly that, per the unit-#2 adapter contract.
import { redirect as routerRedirect, useRouter as useTanStackRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { hrefToLocation } from './href';

/**
 * The `next/navigation` `AppRouterInstance` shape (App Router — push/replace return
 * `void`, not the Pages-Router `Promise<boolean>`). Only the members the live app uses
 * are typed; `ReadonlyURLSearchParams`/`PrefetchKind` and other unused niceties are
 * intentionally omitted (see spec — "the only APIs actually used").
 */
export interface AppRouterInstance {
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}

/** `next/navigation` `NavigateOptions` (only `scroll` is honored by the live app). */
export interface NavigateOptions {
  scroll?: boolean;
}

// TanStack's `navigate`/`preloadRoute` arg + `history`/`invalidate` types are keyed off
// the registered route tree, so a runtime `href: string` doesn't satisfy the typed `to`.
// We pass a string at the seam (the same tradeoff `components/link.tsx` makes) and read
// the router through this loosened view — one cast, so the call sites below stay checked
// against the Next-shaped contract. Typed-route safety returns when surfaces are rewritten
// to native `<Link to=.. />` / `useSearch`.
interface NextCompatRouter {
  navigate(opts: {
    to: string;
    search?: Record<string, unknown>;
    hash?: string;
    replace?: boolean;
    resetScroll?: boolean;
  }): Promise<unknown>;
  preloadRoute(opts: { to: string; search?: Record<string, unknown>; hash?: string }): Promise<unknown>;
  invalidate(): Promise<unknown>;
  history: { go(delta: number): void };
}

// A navigation can reject when it is superseded/aborted or blocked; the App Router
// methods are `void`, so we swallow the rejection rather than leak an unhandled one.
const ignoreNavigationError = (): void => {};

/**
 * Drop-in for `next/navigation` `useRouter()`. Maps the App Router imperative API onto
 * the TanStack router instance per the unit-#2 adapter contract:
 *
 * | Next                | TanStack backing                                  |
 * |---------------------|---------------------------------------------------|
 * | `push(href)`        | `navigate(hrefToLocation(href))`                  |
 * | `replace(href)`     | `navigate({ ...hrefToLocation(href), replace })`  |
 * | `back()` / `forward()` | `history.go(-1)` / `history.go(1)`             |
 * | `refresh()`         | `router.invalidate()`                             |
 * | `prefetch(href)`    | `router.preloadRoute(hrefToLocation(href))`       |
 *
 * `href` is split into `{ to, search?, hash? }` via `hrefToLocation` — TanStack treats a
 * bare `to` as a pathname only, so a query string folded into `to` would silently no-op.
 *
 * Next's `{ scroll: false }` maps to TanStack's `{ resetScroll: false }` (default is to
 * reset). The returned object is memoized on the (stable) router instance so consumers
 * can safely list it in effect/callback deps, matching Next's stable router reference.
 */
export function useRouter(): AppRouterInstance {
  const router = useTanStackRouter() as unknown as NextCompatRouter;

  return useMemo<AppRouterInstance>(
    () => ({
      push: (href, options) => {
        router
          .navigate({ ...hrefToLocation(href), resetScroll: options?.scroll !== false })
          .catch(ignoreNavigationError);
      },
      replace: (href, options) => {
        router
          .navigate({ ...hrefToLocation(href), replace: true, resetScroll: options?.scroll !== false })
          .catch(ignoreNavigationError);
      },
      back: () => router.history.go(-1),
      forward: () => router.history.go(1),
      refresh: () => {
        router.invalidate().catch(ignoreNavigationError);
      },
      prefetch: (href) => {
        router.preloadRoute(hrefToLocation(href)).catch(ignoreNavigationError);
      },
    }),
    [router]
  );
}

/**
 * Drop-in for `next/navigation` `redirect(url)`. Next's `redirect` never returns — it
 * throws a framework signal that SSR turns into a 307/308 and the client turns into a
 * navigation. TanStack's `redirect()` is the equivalent throwable: thrown from SSR render
 * / a route loader / `beforeLoad` it yields a real HTTP redirect, and on the client the
 * RouterProvider catches it and performs `router.navigate({ to })` — exactly the contract
 * backing. We `throw` it (not return) to preserve Next's `never` contract.
 *
 * Absolute URLs (the OAuth `redirect_uri` case in `app/oauth/consent/page.tsx`, plus
 * `mailto:`/`tel:`) go through TanStack's `href` field, which infers a full-document
 * navigation; internal paths use the soft-nav `{ to, search?, hash? }` form (via
 * `hrefToLocation`) so a query string isn't swallowed into the pathname.
 *
 * Bridge note: this matches the two live `redirect` callers, which are server components
 * (`app/page.tsx`, `app/oauth/consent/page.tsx`) that throw during render — the path
 * TanStack handles cleanly. A redirect fired from a *client event handler* (outside
 * render/loader) is NOT auto-caught by the router; use `useRouter().replace(url)` there.
 */
export function redirect(url: string): never {
  const isAbsolute =
    /^https?:\/\//.test(url) || url.startsWith('//') || url.startsWith('mailto:') || url.startsWith('tel:');
  throw routerRedirect((isAbsolute ? { href: url } : hrefToLocation(url)) as Parameters<typeof routerRedirect>[0]);
}
