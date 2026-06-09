// next/link inventory: 26 importer sites on main (verified via grep). The TanStack
// build aliases `next/link` → this shim (Area B); the live Next build keeps real
// next/link. So this must be a drop-in for the prop surface those 26 sites use.
//
// Prop surface in use across the 26 sites:
//   href (string), prefetch={false} (18×), className, onClick, tabIndex, key,
//   passHref (2× in src/home/index.tsx), and a {...props} spread (ProfileInfoContent's
//   Linkify render) that can carry target/rel. The contract also requires replace.
//
// Routing model: internal string hrefs go through TanStack <Link> (typed routes +
// intent preload). External/absolute URLs (https?://, //, mailto:, tel:, #) fall back
// to a plain <a>. next/link `prefetch={false}` maps to preload={false}; the default is
// preload="intent". Dynamic typed routes (e.g. /profile/$username) stay string-href
// here and are better rewritten as native <Link to params={...}> when a surface ports.
import { type LinkComponentProps, Link as RouterLink } from '@tanstack/react-router';
import type { AnchorHTMLAttributes } from 'react';
import { hrefToLocation } from '@/web/lib/navigation/href';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  // next/link routing props we honor:
  prefetch?: boolean;
  replace?: boolean;
  // next/link-only props that are NOT valid DOM/anchor attributes. Accepted here so
  // call sites compile, then dropped before render so they never leak onto the element
  // (React warns on unknown DOM attributes). No-ops in the TanStack world.
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
};

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#');
}

export default function Link({
  href,
  prefetch,
  replace,
  // strip next-only props so they don't reach <a>/<RouterLink>:
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  legacyBehavior: _legacyBehavior,
  children,
  ...rest
}: LinkProps) {
  // `rest` now carries only real anchor attributes (className, target, rel, onClick,
  // tabIndex, style, aria-*, id, title, role, …) — all valid on <a> and RouterLink.
  if (isExternal(href)) {
    // External/absolute: a plain anchor. `replace` has no meaning for a full-page
    // navigation, so it is intentionally dropped here.
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  // Internal: route through TanStack Router. Split the string href into
  // `{ to, search?, hash? }` — TanStack's <Link> treats a bare `to` as a pathname only, so
  // a query string folded into `to` (e.g. /feeds?channel=following) would silently no-op.
  // typed-route checking happens if/when a surface rewrites to native <Link to=…>.
  // Cast is contained to this shim. Our controlled props go last so a stray spread
  // can never clobber `to`/`search`/`hash`/`preload`/`replace`.
  const routerProps = {
    ...rest,
    ...hrefToLocation(href),
    preload: prefetch === false ? false : 'intent',
    ...(replace ? { replace: true } : {}),
  } as unknown as LinkComponentProps;
  return <RouterLink {...routerProps}>{children}</RouterLink>;
}
