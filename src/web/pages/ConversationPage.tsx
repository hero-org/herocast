import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CastThreadView } from '@/common/components/CastThreadView';
import { PreviewEmbedContext } from '@/common/components/Feed/PreviewEmbedContext';
import { PageSkeleton } from '@/common/components/PageSkeleton';
import type { FarcasterCast } from '@/common/types/farcaster';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getProvider } from '@/lib/farcaster/providers';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useParams } from '@/web/lib/navigation';

type LoadStatus = 'loading' | 'loaded' | 'not-found';

const PREVIEW_CONTEXT_VALUE = { inPreview: true };

export default function ConversationPage() {
  // C4 (route-semantics): the Next source is a `[...slug]` catch-all whose `useParams()`
  // yields `slug: string[]`. TanStack models the same catch-all as a `$` splat route
  // (`_app.conversation.$.tsx`), whose param arrives as `_splat` — a single "a/b" string.
  // Rebuild the Next-shaped segment array from it so the rest of the page is byte-identical
  // (`getPayloadFromSlug` + the `slug?.join('/')` effect dep are unchanged).
  const params = useParams();
  const slug = ((params._splat as string | undefined) ?? '').split('/').filter(Boolean);
  const [cast, setCast] = useState<FarcasterCast | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const { updateSelectedCast } = useNavigationStore();

  useEffect(() => {
    return () => {
      updateSelectedCast();
    };
  }, [updateSelectedCast]);

  function getPayloadFromSlug(): { identifier: string; type: 'hash' | 'url' } | null {
    if (!slug || slug.length === 0) return null;
    if (slug.length === 1) {
      if (!slug[0].startsWith('0x')) return null;
      return { identifier: slug[0], type: 'hash' };
    }
    if (slug.length === 2) {
      if (!slug[1].startsWith('0x')) return null;
      return { identifier: `https://warpcast.com/${slug[0]}/${slug[1]}`, type: 'url' };
    }
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    const getData = async () => {
      const payload = getPayloadFromSlug();
      if (!payload) {
        setStatus('not-found');
        return;
      }

      setCast(null);
      updateSelectedCast();
      setStatus('loading');

      try {
        const cast = await getProvider().getCastByIdentifier({
          identifier: payload.identifier,
          type: payload.type,
        });
        if (cancelled) return;
        setCast(cast);
        updateSelectedCast(cast);
        setStatus('loaded');
      } catch (err) {
        if (cancelled) return;
        console.error(`Error in conversation page: ${err} ${slug}`);
        setStatus('not-found');
      }
    };

    getData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug?.join('/')]);

  if (status === 'loading') {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6" data-testid="conversation-loading">
          <PageSkeleton variant="profile" />
        </div>
      </div>
    );
  }

  if (status === 'not-found' || !cast) {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 flex justify-center">
          <Card className="w-full max-w-md" data-testid="conversation-not-found">
            <CardHeader>
              <CardTitle>Cast not found</CardTitle>
              <CardDescription>
                We couldn&apos;t find a cast at that link. It may have been deleted or the URL may be incorrect.
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
    // PreviewEmbedContext flips EmbedList over to the smart-group
    // MultiEmbedStack renderer (matching the /feeds preview pane) so the
    // thread view renders embeds the same way users see them in the feed.
    <PreviewEmbedContext.Provider value={PREVIEW_CONTEXT_VALUE}>
      <div className="h-full w-full">
        <CastThreadView cast={cast} containerHeight="100%" />
      </div>
    </PreviewEmbedContext.Provider>
  );
}
