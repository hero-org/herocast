'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <h2 className="mb-4 text-xl font-semibold">Something went wrong!</h2>
          <button onClick={() => reset()} className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
