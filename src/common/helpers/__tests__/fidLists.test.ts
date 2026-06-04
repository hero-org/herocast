import { describe, expect, it } from '@jest/globals';
import { mergeFidsCapped } from '../fidLists';

describe('mergeFidsCapped', () => {
  it('dedupes repeats within the incoming batch (same FID twice -> one copy)', () => {
    const res = mergeFidsCapped(
      [],
      {},
      [
        { fid: '3', displayName: 'dwr' },
        { fid: '3', displayName: 'dwr' },
        { fid: '5', displayName: 'vitalik' },
      ],
      100
    );
    expect(res.fids).toEqual(['3', '5']);
    expect(res.addedCount).toBe(2);
    expect(res.exceedsCap).toBe(false);
  });

  it('skips FIDs already in the list and preserves their display names', () => {
    const res = mergeFidsCapped(
      ['3'],
      { '3': 'dwr' },
      [
        { fid: '3', displayName: 'dwr renamed' },
        { fid: '7', displayName: 'new' },
      ],
      100
    );
    expect(res.fids).toEqual(['3', '7']);
    expect(res.addedCount).toBe(1);
    expect(res.displayNames['3']).toBe('dwr');
    expect(res.displayNames['7']).toBe('new');
  });

  it('caps on the deduped count, not the raw row count', () => {
    const currentFids = Array.from({ length: 99 }, (_, i) => String(i));
    // 3 rows but only 2 unique new FIDs -> 99 + 2 = 101 -> exceeds 100
    const res = mergeFidsCapped(
      currentFids,
      {},
      [
        { fid: '100', displayName: 'a' },
        { fid: '101', displayName: 'b' },
        { fid: '100', displayName: 'a dup' },
      ],
      100
    );
    expect(res.addedCount).toBe(2);
    expect(res.exceedsCap).toBe(true);
    expect(res.availableSlots).toBe(1);
  });

  it('does not false-reject when the deduped count fits exactly (old bug)', () => {
    const currentFids = Array.from({ length: 99 }, (_, i) => String(i));
    // 2 rows, 1 unique new FID -> 99 + 1 = 100, OK. The old per-row count saw 2 -> 101 and rejected.
    const res = mergeFidsCapped(
      currentFids,
      {},
      [
        { fid: '100', displayName: 'a' },
        { fid: '100', displayName: 'a dup' },
      ],
      100
    );
    expect(res.addedCount).toBe(1);
    expect(res.exceedsCap).toBe(false);
  });
});
