import React, { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { openWindow } from '@/common/helpers/navigation';
import { ClipboardIcon, ArrowTopRightOnSquareIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useUrlMetadata } from '@/hooks/queries/useUrlMetadata';
import { cn } from '@/lib/utils';

// Skeleton for loading state - matches final card height
const UrlMetadataSkeleton = ({ compact = false }: { compact?: boolean }) => (
  <div
    className={cn(
      'flex items-center rounded-lg bg-muted/50 border border-muted',
      compact ? 'gap-2 px-2.5 py-2' : 'gap-3 px-3 py-2.5 max-w-lg'
    )}
  >
    <Skeleton className={cn('rounded-md flex-shrink-0', compact ? 'h-5 w-5' : 'h-8 w-8')} />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Skeleton className={cn('rounded', compact ? 'h-3 w-full' : 'h-3.5 w-3/4')} />
      {!compact && <Skeleton className="h-4 w-full rounded" />}
    </div>
  </div>
);

// Simple URL display (fallback when no metadata)
const UrlEmbed = ({ url, compact = false }: { url: string; compact?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWindow(url);
  };

  // Extract domain and path for display
  const getDisplayUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname + urlObj.search;
      return { domain, path: path.length > 1 ? path : '' };
    } catch {
      return { domain: url, path: '' };
    }
  };

  const { domain, path } = getDisplayUrl(url);

  return (
    <div
      className={cn(
        'flex items-center rounded-lg bg-muted/50 border border-muted group',
        compact ? 'gap-2 px-2.5 py-2' : 'gap-2 px-3 py-2 max-w-lg'
      )}
    >
      <LinkIcon className={cn('text-muted-foreground flex-shrink-0', compact ? 'h-5 w-5' : 'h-4 w-4')} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className={cn('font-medium text-foreground truncate', compact ? 'text-xs' : 'text-sm')}>{domain}</span>
          {path && !compact && <span className="text-sm text-muted-foreground truncate">{path}</span>}
        </div>
      </div>
      {!compact && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} title="Copy URL">
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ClipboardIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleOpen} title="Open in new tab">
            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Rich link card with favicon, URL, and title
const RichLinkCard = ({
  url,
  title,
  favicon,
  compact = false,
}: {
  url: string;
  title: string;
  favicon?: string;
  compact?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWindow(url);
  };

  // Truncate URL for display
  const getDisplayUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const display = urlObj.hostname.replace('www.', '') + urlObj.pathname;
      return display.length > 50 ? display.slice(0, 47) + '...' : display;
    } catch {
      return url.length > 50 ? url.slice(0, 47) + '...' : url;
    }
  };

  const displayUrl = getDisplayUrl(url);
  const showFavicon = favicon && !faviconError;

  return (
    <div
      className={cn(
        'flex items-center rounded-lg bg-muted/50 border border-muted group',
        compact ? 'gap-2 px-2.5 py-2' : 'gap-3 px-3 py-2.5 max-w-lg'
      )}
    >
      {/* Favicon or link icon - fixed size container for consistent height */}
      <div className={cn('flex-shrink-0 flex items-center justify-center', compact ? 'h-5 w-5' : 'h-8 w-8')}>
        {showFavicon ? (
          <img
            src={favicon}
            alt=""
            className={cn('rounded object-contain', compact ? 'max-h-5 max-w-5' : 'max-h-8 max-w-8')}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <LinkIcon className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-8 w-8')} />
        )}
      </div>

      {/* URL and title */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {!compact && <p className="text-[11px] text-muted-foreground truncate leading-tight">{displayUrl}</p>}
        <p
          className={cn(
            'font-medium text-foreground truncate',
            compact ? 'text-xs leading-tight' : 'text-sm leading-snug'
          )}
        >
          {title}
        </p>
      </div>

      {/* Actions - only show in non-compact mode */}
      {!compact && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} title="Copy URL">
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ClipboardIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleOpen} title="Open in new tab">
            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
};

const OpenGraphImage = ({
  url,
  skipIntersection = false,
  compact = false,
}: {
  url: string;
  skipIntersection?: boolean;
  compact?: boolean;
}) => {
  // Intersection observer for lazy loading
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '500px', // Start fetching well before visible for fast scrolling
  });

  // Skip intersection observer if in carousel (transform breaks intersection detection)
  const shouldFetch = skipIntersection || inView;

  // Only fetch when in view (or skip intersection check)
  const {
    data: metadata,
    isLoading,
    isError,
  } = useUrlMetadata(url, {
    enabled: shouldFetch,
  });

  // Show skeleton while loading
  if (!shouldFetch || isLoading) {
    return (
      <div ref={ref}>
        <UrlMetadataSkeleton compact={compact} />
      </div>
    );
  }

  // Fallback to simple URL if error or no title
  if (isError || !metadata?.title) {
    return (
      <div ref={ref}>
        <UrlEmbed url={url} compact={compact} />
      </div>
    );
  }

  // Show rich card with metadata
  return (
    <div ref={ref} className={cn('animate-in fade-in duration-200')}>
      <RichLinkCard url={url} title={metadata.title} favicon={metadata.favicon} compact={compact} />
    </div>
  );
};

export default OpenGraphImage;
