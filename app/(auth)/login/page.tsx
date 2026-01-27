'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { UserAuthForm } from '@/common/components/UserAuthForm';
import { useAuth } from '@/common/context/AuthContext';
import { Spinner } from '@/components/ui/spinner';

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
    <div className="min-h-screen flex flex-col">
      {/* Main content - centered */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo and branding */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <img src="/images/logo.png" alt="herocast" width={40} height={40} className="rounded-lg" />
              <span className="text-2xl font-bold tracking-tight">herocast</span>
            </div>
            <p className="text-center text-muted-foreground text-sm">The Farcaster client for power users</p>
          </div>

          {/* Auth form */}
          <UserAuthForm signupOnly={showOnlySignup} />

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <a href="https://herocast.xyz/terms" className="underline hover:text-foreground">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://herocast.xyz/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
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
