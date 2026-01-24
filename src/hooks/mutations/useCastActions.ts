import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { publishReaction, removeReaction } from '@/common/helpers/farcaster';
import { queryKeys } from '@/lib/queryKeys';
import { useAccountStore } from '@/stores/useAccountStore';

/**
 * Type definitions for cast action mutations
 */
interface CastActionParams {
  castHash: string;
  authorFid: number;
}

interface CastActionContext {
  previousFeeds?: Map<string, unknown>;
}

/**
 * Helper to update cast in infinite query cache
 * Updates all matching feed queries with the new cast data
 */
function updateCastInFeeds(
  queryClient: ReturnType<typeof useQueryClient>,
  castHash: string,
  updater: (cast: CastWithInteractions) => CastWithInteractions
) {
  // Get all feed query keys that might contain this cast
  const feedQueryKeys = [
    queryKeys.feeds.all, // Match all feed queries
  ];

  feedQueryKeys.forEach((queryKey) => {
    queryClient.setQueriesData(
      { queryKey, exact: false },
      (oldData: { pages?: Array<{ casts: CastWithInteractions[] }> } | undefined) => {
        if (!oldData?.pages) return oldData;

        const newPages = oldData.pages.map((page) => {
          const newCasts = page.casts.map((cast) => {
            if (cast.hash === castHash) {
              return updater(cast);
            }
            return cast;
          });

          return {
            ...page,
            casts: newCasts,
          };
        });

        return {
          ...oldData,
          pages: newPages,
        };
      }
    );
  });
}

/**
 * Helper to snapshot all feed queries for rollback
 */
function snapshotFeeds(queryClient: ReturnType<typeof useQueryClient>): Map<string, unknown> {
  const snapshot = new Map<string, unknown>();

  // Get all active feed queries
  const queries = queryClient.getQueriesData({ queryKey: queryKeys.feeds.all });

  queries.forEach(([key, data]) => {
    snapshot.set(JSON.stringify(key), data);
  });

  return snapshot;
}

/**
 * Helper to restore feeds from snapshot
 */
function restoreFeeds(queryClient: ReturnType<typeof useQueryClient>, snapshot: Map<string, unknown>) {
  snapshot.forEach((data, keyString) => {
    const key = JSON.parse(keyString);
    queryClient.setQueryData(key, data);
  });
}

/**
 * Hook to like a cast
 *
 * Optimistically updates the cache to show the liked state immediately,
 * then rolls back on error.
 */
export function useLikeCast() {
  const queryClient = useQueryClient();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);

  return useMutation<void, Error, CastActionParams, CastActionContext>({
    mutationFn: async ({ castHash, authorFid }: CastActionParams) => {
      if (!selectedAccount?.id) {
        throw new Error('No account selected');
      }

      await publishReaction({
        accountId: selectedAccount.id,
        reaction: {
          type: 'like',
          target: { fid: authorFid, hash: castHash },
        },
      });
    },

    onMutate: async ({ castHash }: CastActionParams) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.all });

      // Snapshot current state for rollback
      const previousFeeds = snapshotFeeds(queryClient);

      // Optimistically update cast in all feeds
      updateCastInFeeds(queryClient, castHash, (cast) => {
        // Add user's FID to likes array if not already present
        const currentLikes = cast.reactions?.likes || [];
        const alreadyLiked = currentLikes.some((like) => like.fid === userFid);

        if (alreadyLiked) {
          return cast; // Already liked, no update needed
        }

        return {
          ...cast,
          reactions: {
            ...cast.reactions,
            likes: [
              ...currentLikes,
              {
                fid: userFid,
                fname: selectedAccount?.platformUsername || '',
              },
            ],
            likes_count: (cast.reactions?.likes_count || 0) + 1,
          },
        };
      });

      return { previousFeeds };
    },

    onError: (error, variables, context) => {
      console.error('Error liking cast:', error);

      // Rollback optimistic update
      if (context?.previousFeeds) {
        restoreFeeds(queryClient, context.previousFeeds);
      }
    },

    onSuccess: () => {
      // Optionally refetch feeds to get server state
      // For now, we trust the optimistic update
    },
  });
}

/**
 * Hook to remove like from a cast
 *
 * Optimistically updates the cache to remove the liked state immediately,
 * then rolls back on error.
 */
export function useUnlikeCast() {
  const queryClient = useQueryClient();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);

  return useMutation<void, Error, CastActionParams, CastActionContext>({
    mutationFn: async ({ castHash, authorFid }: CastActionParams) => {
      if (!selectedAccount?.id) {
        throw new Error('No account selected');
      }

      await removeReaction({
        accountId: selectedAccount.id,
        reaction: {
          type: 'like',
          target: { fid: authorFid, hash: castHash },
        },
      });
    },

    onMutate: async ({ castHash }: CastActionParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.all });

      // Snapshot current state for rollback
      const previousFeeds = snapshotFeeds(queryClient);

      // Optimistically update cast in all feeds
      updateCastInFeeds(queryClient, castHash, (cast) => {
        // Remove user's FID from likes array
        const currentLikes = cast.reactions?.likes || [];
        const newLikes = currentLikes.filter((like) => like.fid !== userFid);

        return {
          ...cast,
          reactions: {
            ...cast.reactions,
            likes: newLikes,
            likes_count: Math.max((cast.reactions?.likes_count || 0) - 1, 0),
          },
        };
      });

      return { previousFeeds };
    },

    onError: (error, variables, context) => {
      console.error('Error unliking cast:', error);

      // Rollback optimistic update
      if (context?.previousFeeds) {
        restoreFeeds(queryClient, context.previousFeeds);
      }
    },

    onSuccess: () => {
      // Optionally refetch feeds to get server state
      // For now, we trust the optimistic update
    },
  });
}

/**
 * Hook to recast a cast
 *
 * Optimistically updates the cache to show the recasted state immediately,
 * then rolls back on error.
 */
export function useRecast() {
  const queryClient = useQueryClient();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);

  return useMutation<void, Error, CastActionParams, CastActionContext>({
    mutationFn: async ({ castHash, authorFid }: CastActionParams) => {
      if (!selectedAccount?.id) {
        throw new Error('No account selected');
      }

      await publishReaction({
        accountId: selectedAccount.id,
        reaction: {
          type: 'recast',
          target: { fid: authorFid, hash: castHash },
        },
      });
    },

    onMutate: async ({ castHash }: CastActionParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.all });

      // Snapshot current state for rollback
      const previousFeeds = snapshotFeeds(queryClient);

      // Optimistically update cast in all feeds
      updateCastInFeeds(queryClient, castHash, (cast) => {
        // Add user's FID to recasts array if not already present
        const currentRecasts = cast.reactions?.recasts || [];
        const alreadyRecasted = currentRecasts.some((recast) => recast.fid === userFid);

        if (alreadyRecasted) {
          return cast; // Already recasted, no update needed
        }

        return {
          ...cast,
          reactions: {
            ...cast.reactions,
            recasts: [
              ...currentRecasts,
              {
                fid: userFid,
                fname: selectedAccount?.platformUsername || '',
              },
            ],
            recasts_count: (cast.reactions?.recasts_count || 0) + 1,
          },
        };
      });

      return { previousFeeds };
    },

    onError: (error, variables, context) => {
      console.error('Error recasting:', error);

      // Rollback optimistic update
      if (context?.previousFeeds) {
        restoreFeeds(queryClient, context.previousFeeds);
      }
    },

    onSuccess: () => {
      // Optionally refetch feeds to get server state
      // For now, we trust the optimistic update
    },
  });
}

/**
 * Hook to remove recast from a cast
 *
 * Optimistically updates the cache to remove the recasted state immediately,
 * then rolls back on error.
 */
export function useRemoveRecast() {
  const queryClient = useQueryClient();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);

  return useMutation<void, Error, CastActionParams, CastActionContext>({
    mutationFn: async ({ castHash, authorFid }: CastActionParams) => {
      if (!selectedAccount?.id) {
        throw new Error('No account selected');
      }

      await removeReaction({
        accountId: selectedAccount.id,
        reaction: {
          type: 'recast',
          target: { fid: authorFid, hash: castHash },
        },
      });
    },

    onMutate: async ({ castHash }: CastActionParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.all });

      // Snapshot current state for rollback
      const previousFeeds = snapshotFeeds(queryClient);

      // Optimistically update cast in all feeds
      updateCastInFeeds(queryClient, castHash, (cast) => {
        // Remove user's FID from recasts array
        const currentRecasts = cast.reactions?.recasts || [];
        const newRecasts = currentRecasts.filter((recast) => recast.fid !== userFid);

        return {
          ...cast,
          reactions: {
            ...cast.reactions,
            recasts: newRecasts,
            recasts_count: Math.max((cast.reactions?.recasts_count || 0) - 1, 0),
          },
        };
      });

      return { previousFeeds };
    },

    onError: (error, variables, context) => {
      console.error('Error removing recast:', error);

      // Rollback optimistic update
      if (context?.previousFeeds) {
        restoreFeeds(queryClient, context.previousFeeds);
      }
    },

    onSuccess: () => {
      // Optionally refetch feeds to get server state
      // For now, we trust the optimistic update
    },
  });
}
