import type { FarcasterCast } from '@/common/types/farcaster';

/**
 * Count the "new" casts sitting above the user's last acknowledged top cast —
 * i.e. how many to surface in the NewCastsPill.
 *
 * The viewer's own casts are excluded: a cast you just published is
 * optimistically prepended to the feed (#739) but isn't "new" content to scroll
 * up for, so it must not inflate the pill. In the steady state (no own casts
 * present) the filter is a no-op, so the count is unchanged.
 *
 * Returns 0 when there's nothing acknowledged yet, when the head is unchanged,
 * or when the acknowledged cast has been pruned from the list — the conservative
 * path avoids a surprise count after a feed refresh drops the previous head.
 */
export function countNewCastsAboveAcknowledged(
  casts: Pick<FarcasterCast, 'hash' | 'author'>[],
  acknowledgedHash: string | null,
  viewerFid: number
): number {
  if (acknowledgedHash === null || casts.length === 0) return 0;
  if (casts[0]?.hash === acknowledgedHash) return 0;

  const idx = casts.findIndex((c) => c.hash === acknowledgedHash);
  if (idx <= 0) return 0;

  return casts.slice(0, idx).filter((c) => c.author?.fid !== viewerFid).length;
}
