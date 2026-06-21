// Unit #9 (#754 auth/accounts) — pathless layout = the port of app/(auth)/layout.tsx
// (leading `_` is TanStack's pathless convention; it adds no URL segment). Centers the
// onboarding pages and sits OUTSIDE the `_app` shell (no app chrome — like the Next
// `(auth)` group). The welcome routes are its children (`_auth.welcome.*.tsx`).
//
// `/login` is intentionally NOT under this layout — it keeps its own `routes/login.tsx`
// (per the kickoff) and self-centers (LoginContent carries `min-h-screen`), so it renders
// identically without the wrapper.
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Outlet />
    </div>
  );
}
