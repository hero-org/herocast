import React from 'react';
import { cn } from '@/lib/utils';

export interface MiniAppSplashProps {
  iconUrl?: string;
  name?: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
}

export const MiniAppSplash: React.FC<MiniAppSplashProps> = ({
  iconUrl,
  name,
  splashImageUrl,
  splashBackgroundColor = '#ffffff',
}) => {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: splashBackgroundColor }}
    >
      <div className="flex flex-col items-center justify-center space-y-6">
        {splashImageUrl ? (
          <img
            src={splashImageUrl}
            alt={name || 'Mini App'}
            className="h-48 w-48 object-contain"
          />
        ) : iconUrl ? (
          <img
            src={iconUrl}
            alt={name || 'Mini App'}
            className="h-24 w-24 rounded-2xl object-cover shadow-lg"
          />
        ) : null}

        {name && (
          <h2 className="text-2xl font-semibold text-foreground">
            {name}
          </h2>
        )}

        {/* Loading spinner */}
        <div className="flex items-center space-x-2">
          <div className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            "bg-foreground/60"
          )}
          style={{ animationDelay: '0ms' }}
          />
          <div className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            "bg-foreground/60"
          )}
          style={{ animationDelay: '150ms' }}
          />
          <div className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            "bg-foreground/60"
          )}
          style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
};
