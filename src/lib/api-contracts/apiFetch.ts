import type { z } from 'zod';
import { fetchWithPerf } from '@/lib/fetchWithPerf';
import { ApiContractError } from './errors';

/**
 * Typed fetch wrapper that validates responses against a Zod schema.
 *
 * Wraps {@link fetchWithPerf} so perf telemetry is preserved. On parse failure
 * an {@link ApiContractError} is thrown with the structured issues array.
 *
 * @example
 * const data = await apiFetch(followingFeedResponseSchema, '/api/feeds/following?fid=1', {
 *   perfName: 'feed:following',
 * });
 */
export async function apiFetch<S extends z.ZodTypeAny>(
  schema: S,
  url: string,
  init?: RequestInit & { perfName?: string }
): Promise<z.infer<S>> {
  const { perfName, ...rest } = init ?? {};
  const res = await fetchWithPerf(url, rest, { name: perfName ?? `api:${url}` });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiContractError({
      url,
      issues: parsed.error.issues,
      see_also: 'docs/agents/api-contract-policy.md',
    });
  }
  return parsed.data;
}
