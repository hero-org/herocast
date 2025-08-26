'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import Link from 'next/link';

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
  React.useEffect(() => {
    // Report error to Sentry with auth context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'auth');
      scope.setContext('auth', {
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      });
      Sentry.captureException(error);
    });
  }, [error]);

  const handleReset = () => {
    // Clear auth-related data that might be causing the error
    if (typeof window !== 'undefined') {
      try {
        // Clear auth-related session storage
        const keysToRemove = Object.keys(sessionStorage).filter(key => 
          key.includes('auth') || key.includes('farcaster') || key.includes('signer')
        );
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear auth session data:', e);
      }
    }
    reset();
  };

  // Determine if this is likely an authentication-related error
  const isAuthError = error.message.toLowerCase().includes('auth') ||
    error.message.toLowerCase().includes('unauthorized') ||
    error.message.toLowerCase().includes('forbidden') ||
    error.message.toLowerCase().includes('signer');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Authentication Error
          </h1>
          <p className="text-foreground/70">
            {isAuthError 
              ? "There was a problem with authentication. Please try signing in again."
              : "Something went wrong during the authentication process."
            }
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left p-4 bg-muted rounded-lg">
            <summary className="cursor-pointer text-sm font-semibold text-foreground/80 mb-2">
              Error Details (Development Only)
            </summary>
            <pre className="text-xs text-foreground/60 overflow-x-auto whitespace-pre-wrap">
              {error.message}
              {error.stack && '\n\nStack trace:\n' + error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={handleReset} className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          
          {isAuthError && (
            <Button variant="outline" asChild className="flex items-center justify-center gap-2">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Sign in again
              </Link>
            </Button>
          )}
          
          <Button variant="ghost" asChild>
            <Link href="/">
              <span aria-hidden="true">←</span>
              Back to home
            </Link>
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-foreground/50">
            Need help? Try refreshing the page or clearing your browser data.
          </p>
          {error.digest && (
            <p className="text-xs text-foreground/40 mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}