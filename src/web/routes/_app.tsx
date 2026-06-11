// Unit #5 (#754 app shell) — the `app/(app)/layout.tsx` equivalent: a PATHLESS layout
// route (leading `_` = TanStack's pathless convention — required here, unlike the probes)
// that wraps every ported app page in the untouched `src/home/index.tsx` shell: mobile
// drawer + fixed desktop sidebar (LeftSidebarNav, AccountSwitcher), titlebar with
// per-route title/actions, right-sidebar slot, NewCastModal, Toaster, LiveSpaceBar gate.
//
// REUSE, not re-implementation: `Home` and its whole Sidebar/CommandPalette graph are the
// SAME shared modules the live Next app renders — their `next/navigation`/`next/link`/
// `next/image`/`next/dynamic` imports resolve to the `src/web` adapters via the unit-#2
// vite aliases, so no shared file is edited and the CLAUDE.md layout rules (min-h-0 /
// flex-1) hold byte-for-byte.
//
// Store hydration: `Home` calls `useInitializeStores()`, whose useEffect runs
// `initializeStoresProgressive()` on the CLIENT after the Supabase user resolves — never
// during SSR (unit #4 proved the import path; this mounts it). On the server the children
// slot renders the `isHydrated=false` "Loading herocast" gate — the same pre-hydration
// paint as the live app; do not "fix" that by hydrating stores during SSR.
//
// Page units (#6–#9, #12) add children as `_app.<page>.tsx` (e.g. `_app.feeds.tsx` →
// /feeds inside this shell).
import { createFileRoute, Outlet } from '@tanstack/react-router';
import Home from '@/home';

export const Route = createFileRoute('/_app')({
  component: AppShellLayout,
});

function AppShellLayout() {
  return (
    <Home>
      <Outlet />
    </Home>
  );
}
