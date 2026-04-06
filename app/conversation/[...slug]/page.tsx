'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CastThreadView } from '@/common/components/CastThreadView';
import type { FarcasterCast } from '@/common/types/farcaster';
import { useNavigationStore } from '@/stores/useNavigationStore';

export default function ConversationPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [cast, setCast] = useState<FarcasterCast | null>(null);
  const { updateSelectedCast } = useNavigationStore();

  useEffect(() => {
    // if navigating away, reset the selected cast
    return () => {
      updateSelectedCast();
    };
  }, []);

  function getPayloadFromSlug(): { identifier: string; type: 'hash' | 'url' } {
    return slug && slug?.length === 2
      ? {
          identifier: `https://warpcast.com/${slug[0]}/${slug[1]}`,
          type: 'url',
        }
      : {
          identifier: slug[0],
          type: 'hash',
        };
  }

  useEffect(() => {
    const getData = async () => {
      if (!slug || slug.length === 0) return;
      if (slug.length === 1 && !slug[0].startsWith('0x')) return;
      if (slug.length === 2 && !slug[1].startsWith('0x')) return;

      try {
        const payload = getPayloadFromSlug();
        const params = new URLSearchParams({
          identifier: payload.identifier,
          type: payload.type,
        });

        const response = await fetch(`/api/casts/lookup?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const res = await response.json();
        if (res && res.cast) {
          setCast(res.cast);
        }
      } catch (err) {
        console.error(`Error in conversation page: ${err} ${slug}`);
      }
    };

    getData();
  }, [slug]);

  return (
    <div className="h-full w-full">
      <CastThreadView cast={cast ?? undefined} containerHeight="100%" />
    </div>
  );
}
