// Shared href → TanStack location parser for the navigation seam (unit #2).
//
// P0 (review): TanStack's `navigate` / `<Link>` / `redirect` treat `to` as a PATHNAME
// ONLY. A Next-style string href like `/feeds?channel=following` folded whole into `to`
// is NOT split — no route matches and the navigation silently no-ops. Next's string-href
// API bundles path+query+hash, and the live app leans on it heavily (feed switching in
// useAccountStore, inbox tabs in getNavigationCommands, hotkeys). So every seam that takes
// a Next-style string href routes it through here to produce TanStack's canonical
// `{ to, search?, hash? }` form — which navigate / Link / redirect all handle correctly.
//
// Caveat: repeated query keys collapse (Object.fromEntries). The live app uses only
// single-valued params (channel=, tab=, …), so this is sufficient; revisit if a multi-
// valued query href appears.
export interface ParsedHref {
  to: string;
  search?: Record<string, string>;
  hash?: string;
}

export function hrefToLocation(href: string): ParsedHref {
  const hashIdx = href.indexOf('#');
  const hash = hashIdx >= 0 ? href.slice(hashIdx + 1) : undefined;
  const beforeHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const qIdx = beforeHash.indexOf('?');
  const to = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  const query = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : '';
  const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
  return {
    to,
    ...(search ? { search } : {}),
    ...(hash ? { hash } : {}),
  };
}
