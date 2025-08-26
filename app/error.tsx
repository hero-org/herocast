'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  React.useEffect(() => {
    // Report error to Sentry
    Sentry.captureException(error);
  }, [error]);

  const handleReset = () => {
    // Clear any cached data that might be causing the error
    if (typeof window !== 'undefined') {
      // Clear session storage (drafts, temporary data)
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear session storage:', e);
      }
    }
    reset();
  };

  return (
    <div className="grid min-h-screen grid-cols-1 grid-rows-[1fr,auto,1fr] bg-background lg:grid-cols-[max(50%,36rem),1fr]">
      <header className="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8">
        <a href="/" className="inline-block">
          <span className="sr-only">herocast</span>
          <div className="text-2xl font-bold text-foreground">herocast</div>
        </a>
      </header>
      
      <main className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Something went wrong
            </h1>
          </div>
          
          <p className="text-base leading-7 text-foreground/70 mb-6">
            We encountered an unexpected error. Our team has been notified and we&apos;re working to fix it.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 p-4 bg-muted rounded-lg">
              <summary className="cursor-pointer text-sm font-semibold text-foreground/80 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs text-foreground/60 overflow-x-auto whitespace-pre-wrap">
                {error.message}
                {error.stack && '\n\nStack trace:\n' + error.stack}
              </pre>
            </details>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleReset} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            
            <Button variant="outline" asChild>
              <a href="/">
                <span aria-hidden="true">←</span>
                Back to home
              </a>
            </Button>
          </div>
          
          <p className="mt-8 text-sm text-foreground/50">
            Error ID: {error.digest || 'Unknown'}
          </p>
        </div>
      </main>
      
      <div className="hidden lg:relative lg:col-start-2 lg:row-start-1 lg:row-end-4 lg:block">
        <img 
          src="/images/bw-background.png" 
          alt="" 
          className="absolute inset-0 h-full w-full object-cover opacity-50" 
        />
      </div>
    </div>
  );
}