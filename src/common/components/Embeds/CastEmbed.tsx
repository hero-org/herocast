import isEmpty from 'lodash.isempty';
import { useEffect, useState } from 'react';
import type { FarcasterCast } from '@/common/types/farcaster';
import { CastRow } from '../CastRow';
import { EmbedSkeleton } from './EmbedSkeleton';

type CastEmbedProps = {
  url?: string;
  castId?: { hash: string; fid: number };
  hideReactions?: boolean;
};

const CastEmbed = ({ url, castId, hideReactions }: CastEmbedProps) => {
  const [cast, setCast] = useState<FarcasterCast | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const getData = async () => {
      try {
        let identifier: string;
        let type: 'hash' | 'url';

        if (url) {
          identifier = url;
          type = 'url';
        } else if (castId) {
          identifier = castId.hash;
          type = 'hash';
        } else {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const params = new URLSearchParams({
          identifier,
          type,
        });

        const response = await fetch(`/api/casts/lookup?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const res = await response.json();
        if (!cancelled && res && res.cast) {
          setCast(res.cast);
        }
      } catch (err) {
        // AbortError is expected on selection change — don't surface it.
        if ((err as { name?: string })?.name === 'AbortError') return;
        console.log(`Error in CastEmbed: ${err} ${url} ${castId}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    getData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, castId]);

  // Invalid props - no url AND no castId
  if (!url && !castId) return null;

  // Loading state - show skeleton
  if (isLoading) return <EmbedSkeleton variant="social" />;

  // Loaded but no cast found
  if (isEmpty(cast)) {
    return (
      <div className="max-w-lg rounded-lg border border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
        Cast unavailable
      </div>
    );
  }

  return (
    <div key={`cast-embed-${url}`} className="border border-foreground/30 rounded-lg">
      <CastRow cast={cast} hideReactions={hideReactions} showChannel isEmbed />
    </div>
  );
};

export default CastEmbed;
