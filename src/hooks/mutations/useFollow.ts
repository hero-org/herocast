import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser } from '@/common/helpers/farcaster';
import { queryKeys } from '@/lib/queryKeys';
import { ProfileData } from '@/hooks/queries/useProfile';

interface FollowParams {
  targetFid: number;
  viewerFid: number;
  signerPrivateKey: string;
}

interface FollowMutationContext {
  previousProfile?: ProfileData | null;
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
 * follow.mutate({ targetFid: 123, viewerFid: 456, signerPrivateKey: '0x...' });
 * ```
 */
export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, FollowParams, FollowMutationContext>({
    mutationFn: async ({ targetFid, viewerFid, signerPrivateKey }: FollowParams) => {
      await followUser(targetFid, viewerFid, signerPrivateKey);
    },

    onMutate: async ({ targetFid }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.byFid(targetFid) });

      // Snapshot the previous profile state
      const previousProfile = queryClient.getQueryData<ProfileData>(queryKeys.profiles.byFid(targetFid));

      // Snapshot all bulk profile queries that might contain this profile
      const previousBulkProfiles = new Map<string, ProfileData[]>();
      queryClient.getQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulk([]) }).forEach(([key, data]) => {
        if (data) {
          previousBulkProfiles.set(JSON.stringify(key), data);
        }
      });

      // Optimistically update single profile cache
      queryClient.setQueryData<ProfileData>(queryKeys.profiles.byFid(targetFid), (old) => {
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
      queryClient.setQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulk([]) }, (old) => {
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

      // Return context for potential rollback
      return { previousProfile, previousBulkProfiles };
    },

    onError: (err, { targetFid }, context) => {
      console.error('Failed to follow user:', err);

      // Rollback single profile cache
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(queryKeys.profiles.byFid(targetFid), context.previousProfile);
      }

      // Rollback bulk profile caches
      if (context?.previousBulkProfiles) {
        context.previousBulkProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }
    },

    onSettled: (data, error, { targetFid }) => {
      // Invalidate profile to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.byFid(targetFid) });

      // Also invalidate bulk queries that might contain this profile
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.bulk([]),
        predicate: (query) => {
          const data = query.state.data as ProfileData[] | undefined;
          return data?.some((profile) => profile.fid === targetFid) ?? false;
        },
      });
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
 * unfollow.mutate({ targetFid: 123, viewerFid: 456, signerPrivateKey: '0x...' });
 * ```
 */
export function useUnfollow() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, FollowParams, FollowMutationContext>({
    mutationFn: async ({ targetFid, viewerFid, signerPrivateKey }: FollowParams) => {
      await unfollowUser(targetFid, viewerFid, signerPrivateKey);
    },

    onMutate: async ({ targetFid }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.profiles.byFid(targetFid) });

      // Snapshot the previous profile state
      const previousProfile = queryClient.getQueryData<ProfileData>(queryKeys.profiles.byFid(targetFid));

      // Snapshot all bulk profile queries that might contain this profile
      const previousBulkProfiles = new Map<string, ProfileData[]>();
      queryClient.getQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulk([]) }).forEach(([key, data]) => {
        if (data) {
          previousBulkProfiles.set(JSON.stringify(key), data);
        }
      });

      // Optimistically update single profile cache
      queryClient.setQueryData<ProfileData>(queryKeys.profiles.byFid(targetFid), (old) => {
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
      queryClient.setQueriesData<ProfileData[]>({ queryKey: queryKeys.profiles.bulk([]) }, (old) => {
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

      // Return context for potential rollback
      return { previousProfile, previousBulkProfiles };
    },

    onError: (err, { targetFid }, context) => {
      console.error('Failed to unfollow user:', err);

      // Rollback single profile cache
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(queryKeys.profiles.byFid(targetFid), context.previousProfile);
      }

      // Rollback bulk profile caches
      if (context?.previousBulkProfiles) {
        context.previousBulkProfiles.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }
    },

    onSettled: (data, error, { targetFid }) => {
      // Invalidate profile to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.byFid(targetFid) });

      // Also invalidate bulk queries that might contain this profile
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.bulk([]),
        predicate: (query) => {
          const data = query.state.data as ProfileData[] | undefined;
          return data?.some((profile) => profile.fid === targetFid) ?? false;
        },
      });
    },
  });
}
