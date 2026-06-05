import { Link as RouterLink, type LinkComponentProps } from '@tanstack/react-router';
import type { AnchorHTMLAttributes } from 'react';

// Migration shim for `next/link`. Internal routes go through TanStack Router (typed
// routes + intent preload, which absorbs #737/#736-prefetch). External/absolute URLs
// fall back to a plain <a>. next/link `prefetch={false}` -> preload={false}; default
// is intent preload.
//
// 26 next/link sites migrate in Phase 2. Many use `prefetch={false}` and `onClick`
// handlers, both supported here. Dynamic typed routes (e.g. /profile/$username) are
// better written as native TanStack <Link to params={...}> at the call site; this
// shim is for the mechanical string-href majority.
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
