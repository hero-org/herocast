import React, { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { openWindow } from '@/common/helpers/navigation';
import { ClipboardIcon, ArrowTopRightOnSquareIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useUrlMetadata } from '@/hooks/queries/useUrlMetadata';
import { cn } from '@/lib/utils';

// Skeleton for loading state - matches final card height
const UrlMetadataSkeleton = () => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg">
    <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <Skeleton className="h-3.5 w-3/4 rounded" />
      <Skeleton className="h-4 w-full rounded" />
    </div>
  </div>
);

// Simple URL display (fallback when no metadata)
const UrlEmbed = ({ url }: { url: string }) => {
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-muted max-w-lg group">
      <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground truncate">{domain}</span>
          {path && <span className="text-sm text-muted-foreground truncate">{path}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
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
    </div>
  );
};

// Rich link card with favicon, URL, and title
const RichLinkCard = ({ url, title, favicon }: { url: string; title: string; favicon?: string }) => {
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
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-muted max-w-lg group">
      {/* Favicon or link icon */}
      <div className="flex-shrink-0">
        {showFavicon ? (
          <img src={favicon} alt="" className="h-8 w-8 rounded-md" onError={() => setFaviconError(true)} />
        ) : (
          <LinkIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      {/* URL and title */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-[11px] text-muted-foreground truncate leading-tight">{displayUrl}</p>
        <p className="text-sm font-medium text-foreground truncate leading-snug">{title}</p>
      </div>

      {/* Actions */}
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
    </div>
  );
};

const OpenGraphImage = ({ url, skipIntersection = false }: { url: string; skipIntersection?: boolean }) => {
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
        <UrlMetadataSkeleton />
      </div>
    );
  }

  // Fallback to simple URL if error or no title
  if (isError || !metadata?.title) {
    return (
      <div ref={ref}>
        <UrlEmbed url={url} />
      </div>
    );
  }

  // Show rich card with metadata
  return (
    <div ref={ref} className={cn('animate-in fade-in duration-200')}>
      <RichLinkCard url={url} title={metadata.title} favicon={metadata.favicon} />
    </div>
  );
};

export default OpenGraphImage;
