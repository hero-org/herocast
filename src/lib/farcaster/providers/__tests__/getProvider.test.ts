import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Controllable stand-in for the user settings store's resolved provider. Flipping this mid-test
// simulates hydrate() replacing the synchronous localStorage seed with the authoritative
// Supabase preference.
let currentProvider = 'neynar';

jest.mock('@/stores/useUserSettingsStore', () => ({
  useUserSettingsStore: Object.assign(() => currentProvider, {
    getState: () => ({ farcasterProvider: currentProvider }),
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  getQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// Providers pull in the perf store transitively; stub it so we don't drag in zustand/posthog.
jest.mock('@/stores/usePerformanceStore', () => ({
  measureAsync: <T>(_name: string, fn: () => Promise<T>) => fn(),
  usePerformanceStore: { getState: () => ({ addMetric: jest.fn() }) },
}));

describe('getProvider singleton', () => {
  beforeEach(() => {
    currentProvider = 'neynar';
    // getProviderType() short-circuits to 'neynar' when window is undefined (SSR guard); the node
    // test env has no window, so define one to exercise the client path.
    (globalThis as { window?: unknown }).window = (globalThis as { window?: unknown }).window ?? {};
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('rebuilds the singleton when the resolved provider type changes, instead of pinning the first read', async () => {
    const { getProvider } = await import('../index');

    expect(getProvider().type).toBe('neynar');

    // hydrate() resolves the authoritative provider after the initial seed.
    currentProvider = 'hypersnap';
    expect(getProvider().type).toBe('hypersnap');

    // Not a one-way latch — it tracks the resolved type in both directions.
    currentProvider = 'neynar';
    expect(getProvider().type).toBe('neynar');
  });

  it('returns a stable instance while the provider type is unchanged', async () => {
    const { getProvider } = await import('../index');

    currentProvider = 'hypersnap';
    const first = getProvider();
    const second = getProvider();

    expect(first).toBe(second);
  });
});
