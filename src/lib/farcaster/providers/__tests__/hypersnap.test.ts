import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHypersnapProvider } from '../hypersnap';
import { UnsupportedProviderFeatureError } from '../types';

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

describe('createHypersnapProvider — new provider methods', () => {
  const provider = createHypersnapProvider();
  let fetchMock: jest.Mock<(input: unknown, init?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    fetchMock = jest.fn<(input: unknown, init?: unknown) => Promise<unknown>>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockJson(body: unknown) {
    fetchMock.mockResolvedValue({ ok: true, json: async () => body });
  }

  describe('getUserByUsername', () => {
    it('strips a trailing .eth and lowercases so haatz resolves the bare fname (#715 §4)', async () => {
      mockJson({ user: { username: 'hellno.eth', fid: 13596 } });
      await provider.getUserByUsername({ username: 'Hellno.eth' });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('username=hellno');
      expect(url).not.toContain('.eth');
    });

    it('lowercases the username (haatz user/by-username is case-sensitive)', async () => {
      mockJson({ user: { username: 'dwr', fid: 3 } });
      await provider.getUserByUsername({ username: 'DWR' });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('username=dwr');
    });
  });

  describe('getFidListFeed', () => {
    it('returns casts and the upstream cursor', async () => {
      mockJson({ casts: [{ hash: '0xa' }, { hash: '0xb' }], next: { cursor: 'PAGE_2' } });

      const res = await provider.getFidListFeed({ fids: [1, 2, 3], limit: 15 });

      expect(res.casts.map((c) => c.hash)).toEqual(['0xa', '0xb']);
      expect(res.next?.cursor).toBe('PAGE_2');
    });

    it('caps the FID set at the first 100', async () => {
      mockJson({ casts: [], next: { cursor: undefined } });

      const tooManyFids = Array.from({ length: 150 }, (_, i) => i + 1);
      await provider.getFidListFeed({ fids: tooManyFids, limit: 15 });

      const url = fetchMock.mock.calls[0][0] as string;
      const fidsParam = new URL(url, 'http://x').searchParams.get('fids') ?? '';
      expect(fidsParam.split(',')).toHaveLength(100);
      expect(fidsParam.split(',')[0]).toBe('1');
      expect(fidsParam.split(',')[99]).toBe('100');
    });
  });

  describe('getProfileRepliesAndRecasts', () => {
    it('returns casts and cursor as-is', async () => {
      mockJson({ casts: [{ hash: '0xreply' }], next: { cursor: 'NEXT' } });

      const res = await provider.getProfileRepliesAndRecasts({ fid: 3, limit: 25 });

      expect(res.casts.map((c) => c.hash)).toEqual(['0xreply']);
      expect(res.next?.cursor).toBe('NEXT');
    });
  });

  describe('getProfilePopular', () => {
    it('returns casts with no pagination cursor', async () => {
      mockJson({ casts: [{ hash: '0xpop1' }, { hash: '0xpop2' }] });

      const res = await provider.getProfilePopular({ fid: 3, limit: 25 });

      expect(res.casts.map((c) => c.hash)).toEqual(['0xpop1', '0xpop2']);
      expect(res.next?.cursor).toBeUndefined();
    });
  });

  describe('getTrendingChannels', () => {
    it('returns the channel array', async () => {
      mockJson({ channels: [{ id: 'degen' }, { id: 'base' }] });

      const channels = await provider.getTrendingChannels({ limit: 10 });

      expect(channels.map((c) => c.id)).toEqual(['degen', 'base']);
    });

    it('returns [] when channels is missing', async () => {
      mockJson({});

      const channels = await provider.getTrendingChannels();

      expect(channels).toEqual([]);
    });
  });

  describe('getUserChannels', () => {
    it('returns the channel array', async () => {
      mockJson({ channels: [{ id: 'memes' }] });

      const channels = await provider.getUserChannels({ fid: 3, limit: 20 });

      expect(channels.map((c) => c.id)).toEqual(['memes']);
    });
  });

  describe('getCastReactions', () => {
    it('maps reactions through and defaults missing fields to []/undefined', async () => {
      const reactions = [
        { reaction_type: 'like', reaction_timestamp: '2026-06-03T00:00:00Z', user: { fid: 1 } },
        { reaction_type: 'recast', reaction_timestamp: '2026-06-03T00:01:00Z', user: { fid: 2 } },
      ];
      mockJson({ reactions, next: { cursor: 'MORE' } });

      const res = await provider.getCastReactions({ hash: '0xcast' });

      expect(res.reactions).toHaveLength(2);
      expect(res.reactions[0].reaction_type).toBe('like');
      expect(res.reactions[1].user.fid).toBe(2);
      expect(res.next?.cursor).toBe('MORE');
    });

    it('defaults to likes,recasts and returns [] when reactions is missing', async () => {
      mockJson({});

      const res = await provider.getCastReactions({ hash: '0xcast' });

      expect(res.reactions).toEqual([]);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(new URL(url, 'http://x').searchParams.get('types')).toBe('likes,recasts');
    });
  });

  describe('getBestFriends', () => {
    it('returns the users array', async () => {
      mockJson({ users: [{ fid: 1 }, { fid: 2 }] });

      const users = await provider.getBestFriends({ fid: 3, limit: 5 });

      expect(users.map((u) => u.fid)).toEqual([1, 2]);
    });
  });

  describe('getChannelFeed', () => {
    it('always defers to the fallback provider (haatz feed/channels is unindexed for most channels)', () => {
      // Throws synchronously so the fallback proxy routes the whole query to Neynar — no upstream call.
      expect(() => provider.getChannelFeed({ parentUrl: 'https://warpcast.com/~/channel/degen' })).toThrow(
        UnsupportedProviderFeatureError
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('searchCasts', () => {
    it('runs a plain keyword search against cast/search when only interval/viewerFid are set', async () => {
      mockJson({ result: { casts: [{ hash: '0xc1', author: { fid: 5 }, text: 'gm', timestamp: 't1' }] } });

      const res = await provider.searchCasts({ q: 'ethereum', limit: 10, filters: { interval: 'd7', viewerFid: '3' } });

      expect(res.results.map((r) => r.hash)).toEqual(['0xc1']);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(new URL(url, 'http://x').pathname).toContain('cast/search');
      expect(new URL(url, 'http://x').searchParams.get('q')).toBe('ethereum');
    });

    it('falls back (throws unsupported) when a match-narrowing filter is present', async () => {
      await expect(
        provider.searchCasts({ q: 'ethereum', limit: 10, filters: { channelId: 'degen', interval: 'd7' } })
      ).rejects.toBeInstanceOf(UnsupportedProviderFeatureError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getActiveUsers', () => {
    it('returns [] when viewerFid is missing without calling fetch', async () => {
      const users = await provider.getActiveUsers({ limit: 14 });

      expect(users).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns suggested users when viewerFid is present', async () => {
      mockJson({ users: [{ fid: 7 }, { fid: 8 }] });

      const users = await provider.getActiveUsers({ limit: 14, viewerFid: 3 });

      expect(users.map((u) => u.fid)).toEqual([7, 8]);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(new URL(url, 'http://x').pathname).toContain('following/suggested');
      expect(new URL(url, 'http://x').searchParams.get('fid')).toBe('3');
    });
  });
});
