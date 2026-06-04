import type { QueryClient } from '@tanstack/react-query';
import type { DraftType } from '@/common/constants/farcaster';
import type { CastEmbed, FarcasterCast } from '@/common/types/farcaster';
import { queryKeys } from '@/lib/queryKeys';
import type { AccountObjectType } from '@/stores/useAccountStore';

/**
 * Optimistic feed insertion on publish (#739).
 *
 * After a cast publishes successfully we prepend it into the relevant feed
 * query caches so it appears immediately instead of waiting for a manual
 * refresh. This reuses the same cache-mutation shape as the cast reaction
 * optimistic updates (`src/hooks/mutations/useCastActions.ts`): map over the
 * infinite-query `pages` and rewrite `casts`. The next refetch reconciles the
 * cache with the server response (dedup is by hash, so no duplicate appears).
 *
 * No rollback is needed here — unlike reactions, we insert only after the
 * publish has already succeeded, so there is nothing to undo.
 */

type FeedPageData = { pages?: Array<{ casts: FarcasterCast[] }> };

/**
 * Build a minimal FarcasterCast for a just-published draft. Returns null when
 * the account has no resolved user profile (we'd render a broken row), in
 * which case the caller skips the optimistic insert and lets refetch handle it.
 */
export function buildOptimisticCast(draft: DraftType, account: AccountObjectType, hash: string): FarcasterCast | null {
  const author = account.user;
  if (!author?.fid) return null;

  const embeds: CastEmbed[] = (draft.embeds ?? []).map((embed) =>
    'castId' in embed ? { cast_id: embed.castId } : { url: embed.url }
  );

  return {
    object: 'cast',
    hash,
    parent_hash: draft.parentCastId?.hash ?? null,
    parent_url: draft.parentUrl,
    author,
    text: draft.text ?? '',
    timestamp: new Date().toISOString(),
    embeds,
    reactions: { likes_count: 0, recasts_count: 0, likes: [], recasts: [] },
    replies: { count: 0 },
  };
}

/**
 * Pure helper: prepend `cast` to the first page of an infinite-feed cache,
 * deduped by hash. Returns the data unchanged when the feed is empty/unloaded
 * or already contains the cast.
 */
export function prependCastToFeedData(
  oldData: FeedPageData | undefined,
  cast: FarcasterCast
): FeedPageData | undefined {
  if (!oldData?.pages || oldData.pages.length === 0) return oldData;
  if (oldData.pages.some((page) => page.casts.some((c) => c.hash === cast.hash))) return oldData;

  const [firstPage, ...rest] = oldData.pages;
  return { ...oldData, pages: [{ ...firstPage, casts: [cast, ...firstPage.casts] }, ...rest] };
}

/**
 * Prepend a freshly published cast into the active following feed cache (and
 * the channel feed cache when posted to a channel). `setQueriesData` only
 * touches feeds the user has already loaded, so this is a no-op for feeds that
 * aren't mounted. Replies are skipped — they belong in their thread, not at the
 * top of a feed.
 */
export function insertPublishedCastIntoFeeds(
  queryClient: QueryClient,
  draft: DraftType,
  account: AccountObjectType,
  hash: string
): void {
  if (draft.parentCastId) return;

  const fid = account.platformAccountId;
  if (!fid) return;

  const cast = buildOptimisticCast(draft, account, hash);
  if (!cast) return;

  const update = (oldData: FeedPageData | undefined) => prependCastToFeedData(oldData, cast);

  queryClient.setQueriesData({ queryKey: queryKeys.feeds.followingPrefix(fid), exact: false }, update);
  if (draft.parentUrl) {
    queryClient.setQueriesData({ queryKey: queryKeys.feeds.channelPrefix(draft.parentUrl, fid), exact: false }, update);
  }
}
