import React, { useEffect, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { openWindow } from '@/common/helpers/navigation';
import { ClipboardIcon, ArrowTopRightOnSquareIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline';

type OpenGraphMetadata = {
  image: {
    url: string;
    height: number;
    width: number;
  };
  description: string;
  title: string;
  publisher: string;
};

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
          {path && (
            <span className="text-sm text-muted-foreground truncate">{path}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          title="Copy URL"
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <ClipboardIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleOpen}
          title="Open in new tab"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
    </div>
  );
};

const OpenGraphImage = ({ url }: { url: string }) => {
  const [metadata, setMetadata] = useState<OpenGraphMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const request = await fetch('https://api.modprotocol.org/api/cast-embeds-metadata/by-url', {
          body: JSON.stringify([url]),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await request.json();
        setMetadata(data[url]);
      } catch (error) {
        console.error('Failed to fetch OpenGraph metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  // Always show the clean URL embed - OpenGraph cards were too bulky
  if (!metadata || !metadata.title) {
    return <UrlEmbed url={url} />;
  }

  // For URLs with good metadata, show a compact card
  return (
    <div onClick={() => openWindow(url)} className="cursor-pointer max-w-lg">
      <Card className="rounded-lg border-muted bg-muted/30 hover:bg-muted/50 transition-colors">
        <CardHeader className="p-3 space-y-1">
          {metadata?.image?.url && (
            <img
              className="w-full object-cover max-h-40 rounded-md mb-2"
              src={metadata.image.url}
              alt={metadata.title}
            />
          )}
          <CardTitle className="text-sm font-medium line-clamp-1">{metadata.title}</CardTitle>
          {metadata.description && (
            <CardDescription className="text-xs line-clamp-2">{metadata.description}</CardDescription>
          )}
          <div className="flex items-center gap-1 pt-1">
            <LinkIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">
              {new URL(url).hostname.replace('www.', '')}
            </span>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

export default OpenGraphImage;
