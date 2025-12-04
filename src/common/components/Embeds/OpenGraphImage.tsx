import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { openWindow } from '@/common/helpers/navigation';
import { ClipboardIcon, ArrowTopRightOnSquareIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline';

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

const OpenGraphImage = ({ url }: { url: string }) => {
  // Just show the clean URL embed - modprotocol API is no longer available
  return <UrlEmbed url={url} />;
};

export default OpenGraphImage;
