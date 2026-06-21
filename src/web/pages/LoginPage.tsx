// Unit #9 (#754 auth/accounts) — the real login surface, ported from
// app/(auth)/login/page.tsx. Mounted OUTSIDE the `_app` shell by routes/login.tsx
// (the auth tier has no app chrome, like the Next `(auth)` group).
//
// Surgical changes vs. the Next source (everything else byte-identical):
//   C1  `next/navigation` → `@/web/lib/navigation` (the unit-#2 adapter, imported directly)
//   C3  `'use client'` removed (inert under TanStack)
//
// SSR-safety (G3): `LoginContent` returns the `!didLoad` spinner on the server, so the
// shared `UserAuthForm` — which calls `createClient()` at render scope — NEVER mounts
// during SSR. The form paints client-side after AuthProvider's effect resolves the session.
import { Suspense, useEffect } from 'react';
import { UserAuthForm } from '@/common/components/UserAuthForm';
import { useAuth } from '@/common/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useRouter, useSearchParams } from '@/web/lib/navigation';

function getSafeRedirect(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.startsWith('/login')) return null;
  return path;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, didLoad } = useAuth();
  const signupOnly = searchParams.get('signupOnly');
  const view = searchParams.get('view');
  const redirectParam = searchParams.get('redirect');
  const safeRedirect = getSafeRedirect(redirectParam);
  const showOnlySignup = signupOnly === 'true' || view === 'reset';

  // Redirect logged-in users
  useEffect(() => {
    if (didLoad && user && view !== 'reset') {
      router.replace(safeRedirect || '/feeds');
    }
  }, [didLoad, user, view, router, safeRedirect]);

  // Show minimal loading while checking auth
  if (!didLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Show redirect message if logged in
  if (user && view !== 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm text-muted-foreground">Redirecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo outside card */}
      <div className="flex items-center gap-2 mb-8">
        <img src="/images/logo.png" alt="herocast" width={32} height={32} className="rounded-lg" />
        <span className="text-xl font-semibold tracking-tight">herocast</span>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <UserAuthForm signupOnly={showOnlySignup} />
        </CardContent>
      </Card>

      {/* Footer outside card */}
      <p className="mt-6 text-center text-xs text-muted-foreground max-w-md">
        By clicking continue, you agree to our{' '}
        <a href="https://herocast.xyz/terms" className="underline underline-offset-4 hover:text-foreground">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="https://herocast.xyz/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner size="lg" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
