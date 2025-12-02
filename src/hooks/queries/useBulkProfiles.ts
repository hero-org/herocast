import { useQuery, useQueries } from '@tanstack/react-query';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { queryKeys } from '@/lib/queryKeys';
import { ProfileData } from './useProfile';

const BATCH_SIZE = 100; // Neynar API limit per request

interface UseBulkProfilesOptions {
  viewerFid: number;
  includeAdditionalInfo?: boolean;
  enabled?: boolean;
}

/**
 * Fetches multiple profiles in batches from server-side API
 */
async function fetchBulkProfiles(
  fids: number[],
  viewerFid: number,
  includeAdditionalInfo = false
): Promise<ProfileData[]> {
  if (fids.length === 0) return [];

  const allProfiles: ProfileData[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < fids.length; i += BATCH_SIZE) {
    const batch = fids.slice(i, i + BATCH_SIZE);

    try {
      const params = new URLSearchParams();
      params.append('fids', batch.join(','));
      params.append('viewer_fid', viewerFid.toString());

      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bulk profiles');
      }

      const data = await response.json();
      const users = data.users || [];

      if (users.length > 0) {
        if (includeAdditionalInfo) {
          // Fetch additional info for each user in parallel
          const enrichedUsers = await Promise.all(
            users.map(async (user) => {
              if (user.verified_addresses?.eth_addresses?.length) {
                try {
                  const additionalResponse = await fetch(
                    `/api/additionalProfileInfo?fid=${user.fid}&addresses=${user.verified_addresses.eth_addresses.join(',')}`
                  );
                  if (additionalResponse.ok) {
                    const additionalInfo = await additionalResponse.json();
                    return { ...user, ...additionalInfo };
                  }
                } catch (error) {
                  console.error(`Failed to fetch additional info for FID ${user.fid}:`, error);
                }
              }
              return user;
            })
          );
          allProfiles.push(...enrichedUsers);
        } else {
          allProfiles.push(...users);
        }
      }
    } catch (error) {
      console.error('Failed to fetch batch of profiles:', error);
    }
  }

  return allProfiles;
}

/**
 * Hook for fetching multiple profiles by FIDs
 *
 * Benefits:
 * - Automatic batching (100 FIDs per request)
 * - Request deduplication
 * - Built-in caching with 5-minute staleness
 * - Parallel batch processing
 */
export function useBulkProfiles(fids: number[], options: UseBulkProfilesOptions) {
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options;

  // Sort FIDs for consistent cache keys
  const sortedFids = [...fids].sort((a, b) => a - b);

  return useQuery({
    queryKey: queryKeys.profiles.bulk(sortedFids),
    queryFn: () => fetchBulkProfiles(sortedFids, viewerFid, includeAdditionalInfo),
    enabled: enabled && sortedFids.length > 0 && viewerFid > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching multiple profiles using individual queries
 *
 * This approach gives more granular caching - each profile is cached individually.
 * Use this when you want to benefit from cached individual profiles.
 */
export function useProfiles(fids: number[], options: UseBulkProfilesOptions) {
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options;

  return useQueries({
    queries: fids.map((fid) => ({
      queryKey: queryKeys.profiles.byFid(fid),
      queryFn: async (): Promise<ProfileData | null> => {
        const params = new URLSearchParams();
        params.append('fids', fid.toString());
        params.append('viewer_fid', viewerFid.toString());

        const response = await fetch(`/api/users?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        const user = data.users?.[0];

        if (!user) return null;

        if (includeAdditionalInfo && user.verified_addresses?.eth_addresses?.length) {
          try {
            const additionalResponse = await fetch(
              `/api/additionalProfileInfo?fid=${user.fid}&addresses=${user.verified_addresses.eth_addresses.join(',')}`
            );
            if (additionalResponse.ok) {
              const additionalInfo = await additionalResponse.json();
              return { ...user, ...additionalInfo };
            }
          } catch (error) {
            console.error(`Failed to fetch additional info for FID ${fid}:`, error);
          }
        }

        return user;
      },
      enabled: enabled && fid > 0 && viewerFid > 0,
      staleTime: 1000 * 60 * 5, // 5 minutes
    })),
    combine: (results) => ({
      data: results.map((r) => r.data).filter((d): d is ProfileData => d !== null && d !== undefined),
      isLoading: results.some((r) => r.isLoading),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      errors: results.filter((r) => r.error).map((r) => r.error),
    }),
  });
}

/**
 * Helper to extract profile from bulk query result by FID
 */
export function getProfileFromBulk(profiles: ProfileData[] | undefined, fid: number): ProfileData | undefined {
  return profiles?.find((p) => p.fid === fid);
}
