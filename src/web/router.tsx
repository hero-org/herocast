import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// TanStack Start requires a getRouter() factory returning a fresh router per request.
// defaultPreload: 'intent' is the framework-native prefetch-on-hover/focus that
// absorbs #737 and the prefetch half of #736 (see #754).
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
