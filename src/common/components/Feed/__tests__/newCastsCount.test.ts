import { describe, expect, it } from '@jest/globals';
import type { FarcasterCast } from '@/common/types/farcaster';
import { countNewCastsAboveAcknowledged } from '../newCastsCount';

const VIEWER_FID = 3;

const cast = (hash: string, fid: number): Pick<FarcasterCast, 'hash' | 'author'> =>
  ({ hash, author: { fid } }) as Pick<FarcasterCast, 'hash' | 'author'>;

describe('countNewCastsAboveAcknowledged', () => {
  it('returns 0 before anything is acknowledged', () => {
    expect(countNewCastsAboveAcknowledged([cast('0x1', 9)], null, VIEWER_FID)).toBe(0);
  });

  it('returns 0 when the head is still the acknowledged cast', () => {
    const casts = [cast('0x1', 9), cast('0x2', 9)];
    expect(countNewCastsAboveAcknowledged(casts, '0x1', VIEWER_FID)).toBe(0);
  });

  it('counts casts above the acknowledged head (steady state, no own casts)', () => {
    const casts = [cast('0xa', 9), cast('0xb', 9), cast('0xOLD', 9)];
    expect(countNewCastsAboveAcknowledged(casts, '0xOLD', VIEWER_FID)).toBe(2);
  });

  it("excludes the viewer's own optimistically-inserted cast", () => {
    // Own cast prepended on publish; the acknowledged head is right below it.
    const casts = [cast('0xMINE', VIEWER_FID), cast('0xOLD', 9)];
    expect(countNewCastsAboveAcknowledged(casts, '0xOLD', VIEWER_FID)).toBe(0);
  });

  it("counts others' new casts but not the viewer's own mixed in", () => {
    const casts = [cast('0xMINE', VIEWER_FID), cast('0xOTHER1', 9), cast('0xOTHER2', 7), cast('0xOLD', 9)];
    expect(countNewCastsAboveAcknowledged(casts, '0xOLD', VIEWER_FID)).toBe(2);
  });

  it('returns 0 when the acknowledged cast has been pruned from the list', () => {
    const casts = [cast('0xa', 9), cast('0xb', 9)];
    expect(countNewCastsAboveAcknowledged(casts, '0xGONE', VIEWER_FID)).toBe(0);
  });
});
