'use client';

/**
 * FrameV2Embed — interactive Mini App / Frame v2 host for the preview pane.
 *
 * Wraps `MiniAppHost` (the postMessage-bridged iframe) with two safety nets:
 *
 * 1. A reserved-aspect placeholder shown until the iframe calls `sdk.ready()`
 *    or the timeout fires — eliminates the layout shift the plan calls out.
 * 2. An 8-second readiness timeout. If the iframe never signals ready or
 *    `MiniAppHost` reports an init error, the component swaps to an
 *    `OpenGraphImage` URL fallback. Spec: "On Frame load failure: skeleton
 *    then fall back to clickable URL."
 */

import { useEffect, useMemo, useState } from 'react';
import { MiniAppHost } from '@/common/components/MiniApp';
import { cn } from '@/lib/utils';
import OpenGraphImage from '../Embeds/OpenGraphImage';

type FrameV2EmbedProps = {
  url: string;
  /**
   * Optional name from `cast.frames[i].title` — surfaces in the splash screen
   * before the iframe initializes.
   */
  title?: string;
  /**
   * Optional preview image from `cast.frames[i].image`. Used as the splash
   * background while the iframe boots.
   */
  splashImageUrl?: string;
  className?: string;
};

const READY_TIMEOUT_MS = 8000;

export const FrameV2Embed = ({ url, title, splashImageUrl, className }: FrameV2EmbedProps) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Stable manifest reference — without `useMemo`, MiniAppHost's manifest
  // dependency churns on every parent render, re-rendering MiniAppSplash
  // before the iframe signals ready.
  const manifest = useMemo(() => ({ name: title, splashImageUrl }), [title, splashImageUrl]);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'failed' : current));
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === 'failed') {
    return (
      <div className={cn('w-full', className)}>
        <OpenGraphImage url={url} skipIntersection />
      </div>
    );
  }

  // MiniAppHost owns its own dimensions (it enforces a 424×695 min on the
  // iframe and a 695px min height on its outer wrapper). We deliberately do
  // not impose an `aspectRatio`/`overflow-hidden` box on top — the inner min
  // sizes would blow past it in narrow preview widths and clip the iframe.
  return (
    <div className={cn('w-full max-w-lg rounded-lg border border-muted bg-background', className)}>
      <MiniAppHost
        url={url}
        manifest={manifest}
        onReady={() => setStatus('ready')}
        onError={() => setStatus('failed')}
      />
    </div>
  );
};

export default FrameV2Embed;
