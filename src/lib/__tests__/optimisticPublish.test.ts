import { describe, expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import type { DraftType } from '@/common/constants/farcaster';
import { DraftStatus } from '@/common/constants/farcaster';
import type { FarcasterCast, FarcasterUser } from '@/common/types/farcaster';
import { buildOptimisticCast, insertPublishedCastIntoFeeds, prependCastToFeedData } from '@/lib/optimisticPublish';
import { queryKeys } from '@/lib/queryKeys';
import type { AccountObjectType } from '@/stores/useAccountStore';

const FID = '3';

const author = { fid: 3, username: 'dwr', display_name: 'Dan', pfp_url: 'x' } as unknown as FarcasterUser;
const account = { platformAccountId: FID, user: author } as unknown as AccountObjectType;

const makeDraft = (overrides: Partial<DraftType> = {}): DraftType => ({
  id: 'draft-1',
  text: 'hello world',
  status: DraftStatus.published,
  createdAt: Date.now(),
  ...overrides,
});

const existingCast = (hash: string): FarcasterCast =>
  ({ object: 'cast', hash, text: 'old', author, timestamp: '2024-01-01T00:00:00Z' }) as FarcasterCast;

const feedData = (...hashes: string[]) => ({ pages: [{ casts: hashes.map(existingCast) }], pageParams: [undefined] });

describe('buildOptimisticCast', () => {
  it('builds a renderable cast from the draft + account + hash', () => {
    const cast = buildOptimisticCast(makeDraft({ text: 'gm' }), account, '0xabc');
    expect(cast).toMatchObject({ object: 'cast', hash: '0xabc', text: 'gm', author });
    expect(cast?.reactions).toEqual({ likes_count: 0, recasts_count: 0, likes: [], recasts: [] });
    expect(cast?.replies).toEqual({ count: 0 });
    expect(typeof cast?.timestamp).toBe('string');
  });

  it('maps url and quote-cast embeds to the cast embed shape', () => {
    const cast = buildOptimisticCast(
      makeDraft({ embeds: [{ url: 'https://x.com' }, { castId: { fid: 9, hash: '0xdef' } }] }),
      account,
      '0xabc'
    );
    expect(cast?.embeds).toEqual([{ url: 'https://x.com' }, { cast_id: { fid: 9, hash: '0xdef' } }]);
  });

  it('returns null when the account has no resolved user', () => {
    const noUser = { platformAccountId: FID } as unknown as AccountObjectType;
    expect(buildOptimisticCast(makeDraft(), noUser, '0xabc')).toBeNull();
  });
});

describe('prependCastToFeedData', () => {
  it('prepends the cast to the first page', () => {
    const result = prependCastToFeedData(feedData('0x1', '0x2'), existingCast('0xnew'));
    expect(result?.pages?.[0].casts.map((c) => c.hash)).toEqual(['0xnew', '0x1', '0x2']);
  });

  it('is a no-op when the cast hash is already present (dedup)', () => {
    const data = feedData('0x1', '0x2');
    expect(prependCastToFeedData(data, existingCast('0x2'))).toBe(data);
  });

  it('leaves empty / unloaded caches untouched', () => {
    expect(prependCastToFeedData(undefined, existingCast('0xnew'))).toBeUndefined();
    const empty = { pages: [] };
    expect(prependCastToFeedData(empty, existingCast('0xnew'))).toBe(empty);
  });
});

describe('insertPublishedCastIntoFeeds', () => {
  const followingKey = queryKeys.feeds.following(FID, { limit: 15 });

  it('prepends into the loaded following feed', () => {
    const qc = new QueryClient();
    qc.setQueryData(followingKey, feedData('0x1'));

    insertPublishedCastIntoFeeds(qc, makeDraft(), account, '0xnew');

    const data = qc.getQueryData(followingKey) as ReturnType<typeof feedData>;
    expect(data.pages[0].casts.map((c) => c.hash)).toEqual(['0xnew', '0x1']);
  });

  it('also prepends into the channel feed when posted to a channel', () => {
    const qc = new QueryClient();
    const parentUrl = 'https://channel/dev';
    const channelKey = queryKeys.feeds.channel(parentUrl, FID, { limit: 15 });
    qc.setQueryData(followingKey, feedData('0x1'));
    qc.setQueryData(channelKey, feedData('0x9'));

    insertPublishedCastIntoFeeds(qc, makeDraft({ parentUrl }), account, '0xnew');

    expect((qc.getQueryData(followingKey) as ReturnType<typeof feedData>).pages[0].casts[0].hash).toBe('0xnew');
    expect((qc.getQueryData(channelKey) as ReturnType<typeof feedData>).pages[0].casts[0].hash).toBe('0xnew');
  });

  it('skips replies (parentCastId set)', () => {
    const qc = new QueryClient();
    qc.setQueryData(followingKey, feedData('0x1'));

    insertPublishedCastIntoFeeds(qc, makeDraft({ parentCastId: { fid: 9, hash: '0xparent' } }), account, '0xnew');

    expect((qc.getQueryData(followingKey) as ReturnType<typeof feedData>).pages[0].casts.map((c) => c.hash)).toEqual([
      '0x1',
    ]);
  });

  it('does not duplicate when a refetch already brought the cast back', () => {
    const qc = new QueryClient();
    qc.setQueryData(followingKey, feedData('0xnew', '0x1'));

    insertPublishedCastIntoFeeds(qc, makeDraft(), account, '0xnew');

    expect((qc.getQueryData(followingKey) as ReturnType<typeof feedData>).pages[0].casts.map((c) => c.hash)).toEqual([
      '0xnew',
      '0x1',
    ]);
  });
});
