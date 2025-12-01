import { useQuery } from '@tanstack/react-query';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { queryKeys } from '@/lib/queryKeys';
import { IcebreakerSocialInfo } from '@/common/helpers/icebreaker';
import { CoordinapeAttestation } from '@/common/helpers/coordinapeAttestations';

export type AdditionalUserInfo = {
  icebreakerSocialInfo?: IcebreakerSocialInfo;
  coordinapeAttestations?: CoordinapeAttestation[];
};

export type ProfileData = User & AdditionalUserInfo;

interface UseProfileOptions {
  viewerFid?: number;
  includeAdditionalInfo?: boolean;
  enabled?: boolean;
}

/**
 * Fetches a single profile by FID from server-side API
 */
async function fetchProfileByFid(
  fid: number,
  viewerFid?: number,
  includeAdditionalInfo = false
): Promise<ProfileData | null> {
  const params = new URLSearchParams();
  params.append('fids', fid.toString());
  if (viewerFid) {
    params.append('viewer_fid', viewerFid.toString());
  }

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
      console.error('Failed to fetch additional profile info:', error);
    }
  }

  return user;
}

/**
 * Fetches a profile by username from server-side API
 */
async function fetchProfileByUsername(
  username: string,
  viewerFid: number,
  includeAdditionalInfo = false
): Promise<ProfileData | null> {
  // Remove @ prefix if present
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  const params = new URLSearchParams();
  params.append('q', cleanUsername);
  params.append('viewer_fid', viewerFid.toString());

  const response = await fetch(`/api/users/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search profile');
  }

  const data = await response.json();
  const users = data.users;

  if (!users?.length) return null;

  // Find exact match (handle .eth suffix variants)
  const matchingUsernames = [cleanUsername.toLowerCase(), `${cleanUsername.toLowerCase()}.eth`];
  const user = users.find((u) => matchingUsernames.includes(u.username.toLowerCase()));

  if (!user) return users[0]; // Fall back to first result

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
    queryKey: queryKeys.profiles.byFid(fid ?? 0),
    queryFn: () => fetchProfileByFid(fid!, viewerFid, includeAdditionalInfo),
    enabled: enabled && !!fid && fid > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes (matches PROFILE_UPDATE_INTERVAL)
  });
}

/**
 * Hook for fetching a single profile by username
 */
export function useProfileByUsername(username: string | undefined, options?: UseProfileOptions) {
  const { viewerFid, includeAdditionalInfo = false, enabled = true } = options ?? {};

  return useQuery({
    queryKey: queryKeys.profiles.byUsername(username ?? ''),
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
    queryKey: useFidLookup ? queryKeys.profiles.byFid(fid!) : queryKeys.profiles.byUsername(username ?? ''),
    queryFn: () =>
      useFidLookup
        ? fetchProfileByFid(fid!, viewerFid, includeAdditionalInfo)
        : fetchProfileByUsername(username!, viewerFid ?? 0, includeAdditionalInfo),
    enabled: enabled && (useFidLookup || (!!username && !!viewerFid)),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
