'use client';

import { useCallback, useState } from 'react';
import { useTheme } from 'next-themes';
import { SnapCard } from '@farcaster/snap/react';
import type { SnapPage, SnapActionHandlers } from '@farcaster/snap/react';
import { openWindow } from '@/common/helpers/navigation';
import { EmbedSkeleton } from './EmbedSkeleton';

interface SnapEmbedProps {
  url: string;
  snapData: SnapPage;
}

const SnapEmbed = ({ url, snapData }: SnapEmbedProps) => {
  const [snap, setSnap] = useState<SnapPage>(snapData);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const handleSubmit = useCallback(async (target: string, inputs: Record<string, unknown>) => {
    setLoading(true);
    setActionError(null);

    try {
      const response = await fetch('/api/snap/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          // For now, send unsigned payload. JFS signing will be added as a follow-up.
          body: JSON.stringify({ inputs, timestamp: Math.floor(Date.now() / 1000) }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      if (data.snap) {
        setSnap(data.snap as SnapPage);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenSnap = useCallback(async (target: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({ url: target });
      const response = await fetch(`/api/snap/fetch?${params.toString()}`);
      const data = await response.json();
      if (data.snap) {
        setSnap(data.snap as SnapPage);
      } else {
        // Fallback: open in browser
        openWindow(target);
      }
    } catch {
      openWindow(target);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlers: SnapActionHandlers = {
    submit: (target, inputs) => void handleSubmit(target, inputs),
    open_url: (target) => openWindow(target),
    open_snap: (target) => void handleOpenSnap(target),
    open_mini_app: (target) => openWindow(`/miniapp?url=${encodeURIComponent(target)}`),
    view_cast: ({ hash }) => openWindow(`https://warpcast.com/~/conversations/${hash}`),
    view_profile: ({ fid }) => openWindow(`/profile/${fid}`),
    compose_cast: () => {
      // TODO: integrate with useDraftStore to open composer
      console.log('compose_cast action from snap');
    },
    view_token: () => {},
    send_token: () => {},
    swap_token: () => {},
  };

  return (
    <div className="max-w-lg" onClick={(e) => e.stopPropagation()}>
      <SnapCard
        snap={snap}
        handlers={handlers}
        loading={loading}
        appearance={resolvedTheme === 'dark' ? 'dark' : 'light'}
        actionError={actionError}
      />
    </div>
  );
};

export const SnapEmbedSkeleton = () => <EmbedSkeleton variant="default" />;

export default SnapEmbed;
