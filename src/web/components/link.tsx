// next/link inventory: 26 importer sites on main; no consumers in Phase 1.
//
// Migration shim for `next/link`. Internal routes go through TanStack Router
// (typed routes + intent preload). External/absolute URLs (https?://, //, mailto:,
// tel:, #) fall back to a plain <a>. next/link `prefetch={false}` maps to
// preload={false}; the default is intent preload. Dynamic typed routes
// (e.g. /profile/$username) are better written as native TanStack <Link to params={...}>
// at the call site in Phase 2; this shim is for the mechanical string-href majority.
import { type LinkComponentProps, Link as RouterLink } from '@tanstack/react-router';
import type { AnchorHTMLAttributes } from 'react';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  prefetch?: boolean;
};

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#');
}

export default function Link({ href, prefetch, children, ...rest }: LinkProps) {
  if (isExternal(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  // Cast: the call site passes a runtime string; typed-route checking happens when
  // Phase 2 rewrites sites to native <Link to=...>. Contained to this shim.
  const routerProps = {
    to: href,
    preload: prefetch === false ? false : 'intent',
    ...rest,
  } as unknown as LinkComponentProps;
  return <RouterLink {...routerProps}>{children}</RouterLink>;
}
