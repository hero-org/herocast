// Unit #9 (#754 auth/accounts) — the OAuth-callback failure landing page, ported from
// app/auth/auth-code-error/page.tsx. The 302 callback (routes/api/auth/callback.ts)
// redirects here on a failed `exchangeCodeForSession`. Standalone path in the Next tree
// (NOT in the `(auth)` group), so it sits OUTSIDE the `_app` shell and centers itself.
//
// Surgical changes vs. the Next source (everything else byte-identical):
//   C1  `next/link` → `@/web/components/link`
//   C3  `'use client'` removed
import { AlertCircle, LogIn, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from '@/web/components/link';

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Link Expired or Invalid</h1>
          <p className="text-foreground/70">
            This password reset link may have expired or already been used. Password reset links are only valid for a
            limited time.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="flex items-center justify-center gap-2">
            <Link href="/login">
              <RefreshCw className="h-4 w-4" />
              Request a new reset link
            </Link>
          </Button>

          <Button variant="outline" asChild className="flex items-center justify-center gap-2">
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-foreground/50">If you continue to have problems, please contact support.</p>
        </div>
      </div>
    </div>
  );
}
