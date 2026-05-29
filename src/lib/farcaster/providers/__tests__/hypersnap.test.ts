import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHypersnapProvider } from '../hypersnap';

// Avoid pulling in zustand/posthog via the real performance store — just run the work.
jest.mock('@/stores/usePerformanceStore', () => ({
  measureAsync: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

type FeedCast = { hash: string; parent_hash: string | null; parent_url?: string };

describe('createHypersnapProvider.getFollowingFeed', () => {
  const provider = createHypersnapProvider();
  let fetchMock: jest.Mock<(input: unknown, init?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    fetchMock = jest.fn<(input: unknown, init?: unknown) => Promise<unknown>>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFeed(casts: FeedCast[], cursor: string | undefined = 'CURSOR_123') {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ casts, next: { cursor } }),
    });
  }

  it('drops replies and keeps only root casts', async () => {
    mockFeed([
      { hash: '0xroot1', parent_hash: null },
      { hash: '0xreply1', parent_hash: '0xparentA' },
      { hash: '0xroot2', parent_hash: null },
      { hash: '0xreply2', parent_hash: '0xparentB' },
    ]);

    const res = await provider.getFollowingFeed({ fid: 3, limit: 15 });

    expect(res.casts.map((c) => c.hash)).toEqual(['0xroot1', '0xroot2']);
  });

  it('keeps channel root casts (parent_url set, no parent_hash)', async () => {
    mockFeed([{ hash: '0xchannelroot', parent_hash: null, parent_url: 'https://warpcast.com/~/channel/degen' }]);

    const res = await provider.getFollowingFeed({ fid: 3, limit: 15 });

    expect(res.casts.map((c) => c.hash)).toEqual(['0xchannelroot']);
  });

  it('preserves the upstream pagination cursor after filtering', async () => {
    mockFeed([{ hash: '0xreply1', parent_hash: '0xparentA' }], 'NEXT_PAGE');

    const res = await provider.getFollowingFeed({ fid: 3, limit: 15 });

    expect(res.casts).toEqual([]);
    expect(res.next?.cursor).toBe('NEXT_PAGE');
  });

  it('over-fetches to compensate for filtered replies', async () => {
    mockFeed([]);

    await provider.getFollowingFeed({ fid: 3, limit: 15 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=45'); // 15 * 3
  });

  it('caps the over-fetch at the upstream maximum of 100', async () => {
    mockFeed([]);

    await provider.getFollowingFeed({ fid: 3, limit: 50 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=100'); // 50 * 3 -> capped
  });
});
