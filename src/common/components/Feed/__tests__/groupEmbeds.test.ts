import { describe, expect, it } from '@jest/globals';

import { groupEmbeds } from '../groupEmbeds';

const img = (url: string) => ({ url });

describe('groupEmbeds', () => {
  it('returns empty when there are no embeds', () => {
    expect(groupEmbeds([], undefined)).toEqual([]);
  });

  it('skips Zapper-transaction sentinel URLs', () => {
    const groups = groupEmbeds(
      [{ url: 'https://zapper.xyz/swap/abc' }, { url: 'https://zapper.xyz/nft-sale/xyz' }],
      undefined
    );
    expect(groups).toEqual([]);
  });

  it('skips entries with no url and no cast_id', () => {
    expect(groupEmbeds([{}], undefined)).toEqual([]);
  });

  it('collapses two image URLs into a single 1×2 gallery', () => {
    const groups = groupEmbeds(
      [img('https://i.imgur.com/a.png'), img('https://res.cloudinary.com/x/image/upload/b.jpg')],
      undefined
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      kind: 'image-gallery',
      urls: ['https://i.imgur.com/a.png', 'https://res.cloudinary.com/x/image/upload/b.jpg'],
    });
  });

  it('collapses three image URLs into a single gallery (1×3 layout chosen by renderer)', () => {
    const groups = groupEmbeds(
      [img('https://imagedelivery.net/a'), img('https://imagedelivery.net/b'), img('https://imagedelivery.net/c')],
      undefined
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('image-gallery');
    if (groups[0].kind === 'image-gallery') {
      expect(groups[0].urls).toHaveLength(3);
    }
  });

  it('collapses four image URLs into a single gallery (2×2 layout chosen by renderer)', () => {
    const urls = ['a', 'b', 'c', 'd'].map((s) => `https://imagedelivery.net/${s}`);
    const groups = groupEmbeds(urls.map(img), undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('image-gallery');
    if (groups[0].kind === 'image-gallery') {
      expect(groups[0].urls).toEqual(urls);
    }
  });

  it('emits a slot per non-image embed in original order, with images collapsed first', () => {
    const groups = groupEmbeds(
      [{ url: 'https://example.com/article' }, img('https://i.imgur.com/x.png'), { url: 'https://x.com/foo/status/1' }],
      undefined
    );

    // Image gallery comes first, then the URL slot, then the tweet slot.
    expect(groups.map((g) => (g.kind === 'image-gallery' ? 'gallery' : g.slotKind))).toEqual([
      'gallery',
      'url',
      'tweet',
    ]);
  });

  it('dispatches video URLs to a video slot', () => {
    const groups = groupEmbeds([{ url: 'https://stream.warpcast.com/playlist.m3u8' }], undefined);
    expect(groups).toEqual([
      { kind: 'slot', slotKind: 'video', embed: { url: 'https://stream.warpcast.com/playlist.m3u8' } },
    ]);
  });

  it('dispatches farcaster.xyz HLS streams to a video slot', () => {
    const groups = groupEmbeds([{ url: 'https://stream.farcaster.xyz/abc' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'video' });
  });

  it('dispatches Warpcast cast URLs to a cast slot', () => {
    const groups = groupEmbeds([{ url: 'https://warpcast.com/dan/0xabcdef' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'cast' });
  });

  it('does not classify Warpcast settings/profile (~) URLs as casts', () => {
    const groups = groupEmbeds([{ url: 'https://warpcast.com/~/settings' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'url' });
  });

  it('dispatches twitter.com status URLs to a tweet slot', () => {
    const groups = groupEmbeds([{ url: 'https://twitter.com/foo/status/1234' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'tweet' });
  });

  it('dispatches x.com status URLs to a tweet slot', () => {
    const groups = groupEmbeds([{ url: 'https://x.com/foo/status/5678' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'tweet' });
  });

  it('dispatches embeds with cast_id to a cast slot regardless of URL presence', () => {
    const groups = groupEmbeds(
      [
        {
          cast_id: { fid: 123, hash: '0xdeadbeef' },
        },
      ],
      undefined
    );
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'cast' });
  });

  it('routes Frame v2 embeds (version "next" in cast.frames) to a frame-v2 slot', () => {
    const url = 'https://example.com/miniapp';
    const frames = [{ version: 'next', frames_url: url, image: 'https://x/y.png', title: 'My App' }];
    const groups = groupEmbeds([{ url }], frames);
    expect(groups[0]).toMatchObject({
      kind: 'slot',
      slotKind: 'frame-v2',
      frame: { version: 'next', frames_url: url },
    });
  });

  it('does NOT route v1 frames (version "vNext") to frame-v2 slot — falls through to URL slot', () => {
    const url = 'https://example.com/v1frame';
    const frames = [{ version: 'vNext', frames_url: url, image: 'https://x/y.png' }];
    const groups = groupEmbeds([{ url }], frames);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'url' });
  });

  it('falls through to a generic url slot when nothing else matches', () => {
    const groups = groupEmbeds([{ url: 'https://blog.example.com/post' }], undefined);
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'url', embed: { url: 'https://blog.example.com/post' } });
  });

  it('treats embeds with both cast_id and url as cast slots (cast_id wins)', () => {
    const groups = groupEmbeds(
      [{ url: 'https://example.com/something', cast_id: { fid: 1, hash: '0xabc' } }],
      undefined
    );
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'cast' });
  });

  it('handles a non-array `frames` value without throwing', () => {
    expect(groupEmbeds([{ url: 'https://example.com/x' }], null)).toHaveLength(1);
    expect(groupEmbeds([{ url: 'https://example.com/x' }], { not: 'an array' })).toHaveLength(1);
    expect(groupEmbeds([{ url: 'https://example.com/x' }], 'malformed')).toHaveLength(1);
  });

  it('skips frame entries that are missing frames_url', () => {
    const url = 'https://example.com/miniapp';
    const frames = [{ version: 'next' /* no frames_url */ }, null, 'garbage'];
    const groups = groupEmbeds([{ url }], frames);
    // Falls through to URL slot because no frame matched.
    expect(groups[0]).toMatchObject({ kind: 'slot', slotKind: 'url' });
  });

  it('handles a mixed cast: 2 images + 1 video + 1 quote cast + 1 frame', () => {
    const frameUrl = 'https://example.com/miniapp';
    const groups = groupEmbeds(
      [
        img('https://i.imgur.com/a.png'),
        { url: 'https://stream.warpcast.com/v.m3u8' },
        img('https://i.imgur.com/b.png'),
        { cast_id: { fid: 1, hash: '0xfeed' } },
        { url: frameUrl },
      ],
      [{ version: 'next', frames_url: frameUrl }]
    );
    expect(groups.map((g) => (g.kind === 'image-gallery' ? 'gallery' : g.slotKind))).toEqual([
      'gallery',
      'video',
      'cast',
      'frame-v2',
    ]);
    if (groups[0].kind === 'image-gallery') {
      expect(groups[0].urls).toEqual(['https://i.imgur.com/a.png', 'https://i.imgur.com/b.png']);
    }
  });

  it('collapses duplicate cast_id embeds into a single cast slot', () => {
    const hash = '0xe07445af2f361de5cd36b9e15b56d41685ed1211';
    const groups = groupEmbeds(
      [{ cast_id: { fid: 4044, hash } }, { cast_id: { fid: 4044, hash } }, { cast_id: { fid: 4044, hash } }],
      undefined
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('slot');
    if (groups[0].kind === 'slot') {
      expect(groups[0].slotKind).toBe('cast');
    }
  });

  it('drops a farcaster.xyz/~/ca/ URL when the same cast hash is already a cast_id embed', () => {
    const hash = '0xe07445af2f361de5cd36b9e15b56d41685ed1211';
    const groups = groupEmbeds(
      [
        { cast_id: { fid: 4044, hash } },
        { url: `https://farcaster.xyz/~/ca/${hash}` },
        { cast_id: { fid: 4044, hash } },
      ],
      undefined
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('slot');
  });

  it('drops a warpcast.com user/short-hash URL when the matching full cast_id is present', () => {
    const fullHash = '0xe07445af2f361de5cd36b9e15b56d41685ed1211';
    const shortHash = '0xe07445af2f';
    const groups = groupEmbeds(
      [{ cast_id: { fid: 4044, hash: fullHash } }, { url: `https://warpcast.com/alec.eth/${shortHash}` }],
      undefined
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('slot');
  });

  it('keeps unrelated cast_id and URL embeds when they do not match', () => {
    const groups = groupEmbeds(
      [
        { cast_id: { fid: 4044, hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
        { url: 'https://farcaster.xyz/~/ca/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
      undefined
    );
    expect(groups).toHaveLength(2);
  });

  it('dedupes a non-image URL embed appearing twice', () => {
    const groups = groupEmbeds(
      [{ url: 'https://example.com/article' }, { url: 'https://example.com/article' }],
      undefined
    );
    expect(groups).toHaveLength(1);
  });
});
