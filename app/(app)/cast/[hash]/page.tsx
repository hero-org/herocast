'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CastRow } from '@/common/components/CastRow';
import { PageSkeleton } from '@/common/components/PageSkeleton';
import { fetchCastByHash } from '@/common/helpers/neynar';
import type { FarcasterCast } from '@/common/types/farcaster';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigationStore } from '@/stores/useNavigationStore';

type LoadStatus = 'loading' | 'loaded' | 'not-found';

export default function CastDeepLinkPage() {
  const params = useParams();
  const hash = (Array.isArray(params?.hash) ? params.hash[0] : params?.hash) as string | undefined;
  const [cast, setCast] = useState<FarcasterCast | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const { updateSelectedCast } = useNavigationStore();

  useEffect(() => {
    return () => {
      // Clear selected cast on unmount so the right sidebar doesn't keep stale context
      updateSelectedCast();
    };
  }, [updateSelectedCast]);

  useEffect(() => {
    let cancelled = false;

    const loadCast = async () => {
      if (!hash || !hash.startsWith('0x')) {
        setStatus('not-found');
        return;
      }

      // Clear stale cast + sidebar state so navigating between /cast/X
      // routes doesn't briefly show the previous cast during the fetch.
      setCast(null);
      updateSelectedCast();
      setStatus('loading');
      const result = await fetchCastByHash(hash);

      if (cancelled) return;

      if (result) {
        setCast(result);
        updateSelectedCast(result);
        setStatus('loaded');
      } else {
        setCast(null);
        setStatus('not-found');
      }
    };

    loadCast();

    return () => {
      cancelled = true;
    };
  }, [hash, updateSelectedCast]);

  if (status === 'loading') {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6" data-testid="cast-deep-link-loading">
          <PageSkeleton variant="profile" />
        </div>
      </div>
    );
  }

  if (status === 'not-found' || !cast) {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 flex justify-center">
          <Card className="w-full max-w-md" data-testid="cast-deep-link-not-found">
            <CardHeader>
              <CardTitle>Cast not found</CardTitle>
              <CardDescription>
                We couldn&apos;t find a cast with that hash. It may have been deleted or the link may be incorrect.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/feeds" className="w-full">
                <Button className="w-full">Back to feeds</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6" data-testid="cast-deep-link" data-cast-hash={cast.hash}>
        <CastRow cast={cast} isEmbed={false} showChannel />
      </div>
    </div>
  );
}
