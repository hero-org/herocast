/**
 * Hub provider selection for Farcaster message submission.
 *
 * Two providers are supported:
 * - 'neynar' (default): Neynar-managed snapchain + legacy Pinata hosts. Uses
 *   `api_key` header. Carries internal redundancy (3 hosts) tried serially on
 *   5xx/network errors.
 * - 'hypersnap': Single Hypersnap/Quilibrium host. Unauthenticated; no
 *   internal chain.
 *
 * Per Spike 3 (S3-P1), there is NO cross-provider fallback. If the selected
 * provider chain is exhausted the caller surfaces the error.
 */

export type HubProvider = 'neynar' | 'hypersnap';

const NEYNAR_HOSTS = [
  'https://snapchain-api.neynar.com',
  'https://hub-api.neynar.com',
  'https://hub.pinata.cloud',
] as const;

const HYPERSNAP_HOSTS = ['https://haatz.quilibrium.com'] as const;

/**
 * Return the ordered list of hub hosts for the given provider. Caller iterates
 * the chain serially. For Neynar this is internal redundancy (continue on
 * 5xx/network); for Hypersnap this is a single host.
 */
export function pickHubChain(provider: HubProvider): readonly string[] {
  return provider === 'hypersnap' ? HYPERSNAP_HOSTS : NEYNAR_HOSTS;
}
