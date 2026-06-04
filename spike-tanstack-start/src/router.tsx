import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// TanStack Start requires a getRouter() factory returning a fresh router per request.
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
