import type React from 'react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { escapeHtml, sanitizeColor, sanitizeImageUrl } from './security';

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
  splashBackgroundColor,
}) => {
  // Defense-in-depth: sanitize all inputs even though parent should also sanitize
  const safeIconUrl = useMemo(() => sanitizeImageUrl(iconUrl), [iconUrl]);
  const safeSplashImageUrl = useMemo(() => sanitizeImageUrl(splashImageUrl), [splashImageUrl]);
  const safeBackgroundColor = useMemo(
    () => sanitizeColor(splashBackgroundColor) || '#18181b', // Default to zinc-900
    [splashBackgroundColor]
  );
  // Name is rendered as text content (not dangerouslySetInnerHTML), so React handles escaping
  // But we escape anyway for extra safety if the value is used elsewhere
  const safeName = useMemo(() => (name ? escapeHtml(name) : undefined), [name]);

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: safeBackgroundColor }}
    >
      <div className="flex flex-col items-center justify-center space-y-6">
        {safeSplashImageUrl ? (
          <img src={safeSplashImageUrl} alt={safeName || 'Mini App'} className="h-48 w-48 object-contain" />
        ) : safeIconUrl ? (
          <img
            src={safeIconUrl}
            alt={safeName || 'Mini App'}
            className="h-24 w-24 rounded-2xl object-cover shadow-lg"
          />
        ) : null}

        {safeName && <h2 className="text-2xl font-semibold text-foreground">{safeName}</h2>}

        {/* Loading spinner */}
        <div className="flex items-center space-x-2">
          <div
            className={cn('h-2 w-2 rounded-full animate-pulse', 'bg-foreground/60')}
            style={{ animationDelay: '0ms' }}
          />
          <div
            className={cn('h-2 w-2 rounded-full animate-pulse', 'bg-foreground/60')}
            style={{ animationDelay: '150ms' }}
          />
          <div
            className={cn('h-2 w-2 rounded-full animate-pulse', 'bg-foreground/60')}
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
};
