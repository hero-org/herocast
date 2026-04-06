import { useQuery } from '@tanstack/react-query';
import type { CoordinapeAttestation } from '@/common/helpers/coordinapeAttestations';
import type { IcebreakerSocialInfo } from '@/common/helpers/icebreaker';
import type { FarcasterUser } from '@/common/types/farcaster';
import { getProvider } from '@/lib/farcaster/providers';
import { queryKeys } from '@/lib/queryKeys';
import { getProfileBatcher } from './profileBatcher';

export type AdditionalUserInfo = {
  icebreakerSocialInfo?: IcebreakerSocialInfo;
  coordinapeAttestations?: CoordinapeAttestation[];
};

export type ProfileData = FarcasterUser & AdditionalUserInfo;

interface UseProfileOptions {
  viewerFid?: number;
  includeAdditionalInfo?: boolean;
  enabled?: boolean;
}

/**
 * Fetches a single profile by FID using the Farcaster provider
 */
async function fetchProfileByFid(
  fid: number,
  viewerFid?: number,
  includeAdditionalInfo = false
): Promise<ProfileData | null> {
  const user = await getProvider().getUser({ fid, viewerFid });
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
      console.error('Failed to fetch additional profile info:', error);
    }
  }

  return user;
}

/**
 * Fetches a profile by username using the Farcaster provider
 */
async function fetchProfileByUsername(
  username: string,
  viewerFid: number,
  includeAdditionalInfo = false
): Promise<ProfileData | null> {
  // Remove @ prefix if present
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  const user = await getProvider().getUserByUsername({ username: cleanUsername, viewerFid });
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
      console.error('Failed to fetch additional profile info:', error);
    }
  }

  return user;
}

/**
 * Hook for fetching a single profile by FID
 *
 * Benefits over manual fetching:
 * - Automatic request deduplication
 * - Built-in caching with 5-minute staleness
 * - Automatic background refetching
 * - Loading/error states managed automatically
 */
export function useProfileByFid(fid: number | undefined, options?: UseProfileOptions) {
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.profiles.byFid(fid ?? 0, viewerFid),
    // Use batcher for automatic request batching (solves N+1 problem)
    // Falls back to direct fetch when additional info is needed
    queryFn: async (): Promise<ProfileData | null> => {
      if (includeAdditionalInfo) {
        return fetchProfileByFid(fid!, viewerFid, includeAdditionalInfo);
      }
      // Batcher returns ProfileData or undefined if not found
      const profile = await getProfileBatcher(viewerFid).fetch(fid!);
      return profile ?? null;
    },
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes - standard cache duration
  });
}

/**
 * Hook for fetching a single profile by username
 */
export function useProfileByUsername(username: string | undefined, options?: UseProfileOptions) {
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.profiles.byUsername(username ?? '', viewerFid),
    queryFn: () => fetchProfileByUsername(username!, viewerFid ?? 0, includeAdditionalInfo),
    enabled: enabled && !!username && username.length > 0 && !!viewerFid,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching a profile by either FID or username
 *
 * Automatically determines which method to use based on provided params.
 */
export function useProfile(params: { fid?: number; username?: string }, options?: UseProfileOptions) {
  const { fid, username } = params;
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options ?? {};

  // Prefer FID lookup if available (more reliable)
  const useFidLookup = !!fid && fid > 0;

  return useQuery({
    queryKey: useFidLookup
      ? queryKeys.profiles.byFid(fid!, viewerFid)
      : queryKeys.profiles.byUsername(username ?? '', viewerFid),
    queryFn: () =>
      useFidLookup
        ? fetchProfileByFid(fid!, viewerFid, includeAdditionalInfo)
        : fetchProfileByUsername(username!, viewerFid ?? 0, includeAdditionalInfo),
    enabled: enabled && (useFidLookup || (!!username && !!viewerFid)),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
