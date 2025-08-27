'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home, Settings } from 'lucide-react';
import Link from 'next/link';

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  React.useEffect(() => {
    // Report error to Sentry with app context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'app');
      scope.setContext('app', {
        path: window.location.pathname,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Add user context if available
      const userDataString = localStorage.getItem('herocast:user');
      if (userDataString) {
        try {
          const userData = JSON.parse(userDataString);
          scope.setUser({ id: userData.id });
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      Sentry.captureException(error);
    });
  }, [error]);

  const handleReset = () => {
    // Clear app-related data that might be causing the error
    if (typeof window !== 'undefined') {
      try {
        // Clear draft data that might be corrupted
        const keysToRemove = Object.keys(sessionStorage).filter(
          (key) => key.includes('draft') || key.includes('compose') || key.includes('temp')
        );
        keysToRemove.forEach((key) => sessionStorage.removeItem(key));

        // Optionally clear some localStorage cache data (but preserve user data)
        const cacheKeys = Object.keys(localStorage).filter((key) => key.includes('cache') || key.includes('temp'));
        cacheKeys.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear app session data:', e);
      }
    }
    reset();
  };

  // Determine error type for better user guidance
  const isNetworkError =
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('timeout');

  const isDataError =
    error.message.toLowerCase().includes('data') ||
    error.message.toLowerCase().includes('parse') ||
    error.message.toLowerCase().includes('json');

  const getErrorMessage = () => {
    if (isNetworkError) {
      return "We're having trouble connecting to our servers. Please check your internet connection and try again.";
    }
    if (isDataError) {
      return 'There was an issue loading your data. This might be temporary - please try refreshing the page.';
    }
    return 'Something unexpected happened in the application. Our team has been notified.';
  };

  const getErrorSuggestions = () => {
    const suggestions = ['Try refreshing the page'];

    if (isNetworkError) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try again in a few moments');
    }

    if (isDataError) {
      suggestions.push('Clear your browser cache');
      suggestions.push('Try signing out and back in');
    }

    return suggestions;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-foreground/70 text-base leading-relaxed">{getErrorMessage()}</p>
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

        <div className="space-y-3">
          <Button onClick={handleReset} className="w-full flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild className="flex-1 flex items-center justify-center gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go home
              </Link>
            </Button>

            <Button variant="outline" asChild className="flex-1 flex items-center justify-center gap-2">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </div>

        <div className="pt-6 border-t border-border space-y-4">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground mb-2">What you can try:</h3>
            <ul className="text-sm text-foreground/70 space-y-1">
              {getErrorSuggestions().map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-foreground/40 mt-0.5">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>

          {error.digest && (
            <div className="text-xs text-foreground/50 pt-2 border-t border-border">
              Error ID: {error.digest}
              <br />
              <span className="text-foreground/40">Reference this ID if you need to contact support</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
