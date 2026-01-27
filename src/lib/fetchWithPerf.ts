import { endTiming, startTiming } from '@/stores/usePerformanceStore';

/**
 * Fetch wrapper that automatically tracks request performance
 * @param input - Fetch input (URL or Request)
 * @param init - Fetch init options
 * @param options - Performance tracking options
 */
export async function fetchWithPerf(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    /** Custom name for the metric (defaults to URL path) */
    name?: string;
    /** Target duration in ms (default 500) */
    threshold?: number;
    /** Additional metadata to attach */
    metadata?: Record<string, unknown>;
  }
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const urlPath = new URL(url, window.location.origin).pathname;
  const name = options?.name || `api:${urlPath}`;
  const threshold = options?.threshold ?? 500;

  const timingId = startTiming(name);

  try {
    const response = await fetch(input, init);
    endTiming(timingId, threshold, {
      ...options?.metadata,
      status: response.status,
      ok: response.ok,
    });
    return response;
  } catch (error) {
    endTiming(timingId, threshold, {
      ...options?.metadata,
      error: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Create a fetch function pre-configured for a specific API
 */
export function createTrackedFetch(baseName: string, defaultThreshold = 500) {
  return async function trackedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    metadata?: Record<string, unknown>
  ): Promise<Response> {
    return fetchWithPerf(input, init, {
      name: baseName,
      threshold: defaultThreshold,
      metadata,
    });
  };
}
