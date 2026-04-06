import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser } from '@/common/helpers/farcaster';
import type { ProfileData } from '@/hooks/queries/useProfile';
import { queryKeys } from '@/lib/queryKeys';
import { useSocialGraphStore } from '@/stores/useSocialGraphStore';

interface FollowParams {
  targetFid: number;
  accountId: string;
}

interface FollowMutationContext {
  previousProfiles: Map<string, ProfileData | null | undefined>;
  previousBulkProfiles?: Map<string, ProfileData[]>;
}

/**
 * Hook for following a user with optimistic updates
 *
 * Features:
 * - Optimistically updates viewer_context.following to true
 * - Updates both single profile and bulk profile caches
 * - Rolls back on error
 * - Invalidates profile queries on success
 *
 * Usage:
 * ```typescript
 * const follow = useFollow();
 * follow.mutate({ targetFid: 123, accountId: 'uuid' });
 * ```
 */
export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, FollowParams, FollowMutationContext>({
    mutationFn: async ({ targetFid, accountId }: FollowParams) => {
      await followUser(accountId, targetFid);
    },

    onMutate: async ({ targetFid }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) });

      // Snapshot any viewer-specific profile queries for this fid
      const previousProfiles = new Map<string, ProfileData | null | undefined>();
      queryClient
        .getQueriesData<ProfileData>({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) })
        .forEach(([key, data]) => {
          previousProfiles.set(JSON.stringify(key), data);
        });

      // Snapshot all bulk profile queries that might contain this profile
      const previousBulkProfiles = new Map<string, ProfileData[]>();
      queryClient.getQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulkPrefix }).forEach(([key, data]) => {
        if (data) {
          previousBulkProfiles.set(JSON.stringify(key), data);
        }
      });

      // Optimistically update all single profile caches for this fid
      queryClient.setQueriesData<ProfileData>({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) }, (old) => {
        if (!old) return old;
        return {
          ...old,
          viewer_context: {
            followed_by: old.viewer_context?.followed_by ?? false,
            following: true,
          },
        };
      });

      // Optimistically update bulk profile caches
      queryClient.setQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulkPrefix }, (old) => {
        if (!old) return old;
        return old.map((profile) =>
          profile.fid === targetFid
            ? {
                ...profile,
                viewer_context: {
                  followed_by: profile.viewer_context?.followed_by ?? false,
                  following: true,
                },
              }
            : profile
        );
      });

      // Optimistically update social graph store
      useSocialGraphStore.getState().addFollowing(targetFid);

      // Return context for potential rollback
      return { previousProfiles, previousBulkProfiles };
    },

    onError: (err, { targetFid }, context) => {
      console.error('Failed to follow user:', err);

      // Rollback single profile caches
      if (context?.previousProfiles) {
        context.previousProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }

      // Rollback bulk profile caches
      if (context?.previousBulkProfiles) {
        context.previousBulkProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }

      // Rollback social graph store
      useSocialGraphStore.getState().removeFollowing(targetFid);
    },

    onSettled: (data, error, { targetFid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

/**
 * Hook for unfollowing a user with optimistic updates
 *
 * Features:
 * - Optimistically updates viewer_context.following to false
 * - Updates both single profile and bulk profile caches
 * - Rolls back on error
 * - Invalidates profile queries on success
 *
 * Usage:
 * ```typescript
 * const unfollow = useUnfollow();
 * unfollow.mutate({ targetFid: 123, accountId: 'uuid' });
 * ```
 */
export function useUnfollow() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, FollowParams, FollowMutationContext>({
    mutationFn: async ({ targetFid, accountId }: FollowParams) => {
      await unfollowUser(accountId, targetFid);
    },

    onMutate: async ({ targetFid }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) });

      // Snapshot any viewer-specific profile queries for this fid
      const previousProfiles = new Map<string, ProfileData | null | undefined>();
      queryClient
        .getQueriesData<ProfileData>({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) })
        .forEach(([key, data]) => {
          previousProfiles.set(JSON.stringify(key), data);
        });

      // Snapshot all bulk profile queries that might contain this profile
      const previousBulkProfiles = new Map<string, ProfileData[]>();
      queryClient.getQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulkPrefix }).forEach(([key, data]) => {
        if (data) {
          previousBulkProfiles.set(JSON.stringify(key), data);
        }
      });

      // Optimistically update all single profile caches for this fid
      queryClient.setQueriesData<ProfileData>({ queryKey: queryKeys.profiles.byFidPrefix(targetFid) }, (old) => {
        if (!old) return old;
        return {
          ...old,
          viewer_context: {
            followed_by: old.viewer_context?.followed_by ?? false,
            following: false,
          },
        };
      });

      // Optimistically update bulk profile caches
      queryClient.setQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulkPrefix }, (old) => {
        if (!old) return old;
        return old.map((profile) =>
          profile.fid === targetFid
            ? {
                ...profile,
                viewer_context: {
                  followed_by: profile.viewer_context?.followed_by ?? false,
                  following: false,
                },
              }
            : profile
        );
      });

      // Optimistically update social graph store
      useSocialGraphStore.getState().removeFollowing(targetFid);

      // Return context for potential rollback
      return { previousProfiles, previousBulkProfiles };
    },

    onError: (err, { targetFid }, context) => {
      console.error('Failed to unfollow user:', err);

      // Rollback single profile caches
      if (context?.previousProfiles) {
        context.previousProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }

      // Rollback bulk profile caches
      if (context?.previousBulkProfiles) {
        context.previousBulkProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }

      // Rollback social graph store
      useSocialGraphStore.getState().addFollowing(targetFid);
    },

    onSettled: (data, error, { targetFid }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}
