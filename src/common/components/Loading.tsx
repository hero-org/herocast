import clsx from 'clsx';
import React from 'react';

interface LoadingProps {
  className?: string;
  isInline?: boolean;
  loadingMessage?: string;
}

export const Loading = ({ className, isInline = false, loadingMessage = 'Loading' }: LoadingProps) =>
  isInline ? (
    <span
      role="status"
      aria-live="polite"
      className={clsx(className, 'my-4 whitespace-nowrap font-semibold text-foreground/80')}
    >
      {loadingMessage}
      <span className="animate-pulse">...</span>
    </span>
  ) : (
    <p
      role="status"
      aria-live="polite"
      className={clsx(className, 'my-4 whitespace-nowrap font-semibold text-foreground/80')}
    >
      {loadingMessage}
      <span className="animate-pulse">...</span>
    </p>
  );
