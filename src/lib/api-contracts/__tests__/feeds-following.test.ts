import { describe, expect, it } from '@jest/globals';
import {
  buildFollowingFeedResponse,
  followingFeedRequestSchema,
  followingFeedResponseSchema,
  followingFeedResponseSchemaStrict,
} from '../feeds-following';

describe('followingFeedRequestSchema', () => {
  it('accepts valid query params (string coercion)', () => {
    expect(followingFeedRequestSchema.parse({ fid: '123' })).toEqual({ fid: 123, limit: 15 });
  });

  it('accepts explicit limit and cursor', () => {
    expect(followingFeedRequestSchema.parse({ fid: '7', limit: '25', cursor: 'abc' })).toEqual({
      fid: 7,
      limit: 25,
      cursor: 'abc',
    });
  });

  it('rejects missing fid', () => {
    expect(followingFeedRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-numeric fid', () => {
    expect(followingFeedRequestSchema.safeParse({ fid: 'abc' }).success).toBe(false);
  });

  it('rejects out-of-range limit', () => {
    expect(followingFeedRequestSchema.safeParse({ fid: '1', limit: '500' }).success).toBe(false);
  });

  it('rejects limit below 1', () => {
    expect(followingFeedRequestSchema.safeParse({ fid: '1', limit: '0' }).success).toBe(false);
  });
});

describe('followingFeedResponseSchema', () => {
  it('accepts shape with casts + next.cursor', () => {
    expect(followingFeedResponseSchema.safeParse({ casts: [], next: { cursor: 'abc' } }).success).toBe(true);
  });

  it('defaults next when missing', () => {
    expect(followingFeedResponseSchema.parse({ casts: [] })).toEqual({ casts: [], next: {} });
  });

  it('accepts arbitrary cast shapes (z.unknown())', () => {
    const result = followingFeedResponseSchema.safeParse({
      casts: [{ hash: '0xabc' }, { whatever: true }],
      next: {},
    });
    expect(result.success).toBe(true);
  });

  it('rejects when casts is not an array', () => {
    expect(followingFeedResponseSchema.safeParse({ casts: 'oops', next: {} }).success).toBe(false);
  });

  it('rejects when next.cursor is not a string', () => {
    expect(followingFeedResponseSchema.safeParse({ casts: [], next: { cursor: 123 } }).success).toBe(false);
  });
});

/**
 * API contract drift detection.
 *
 * The route's response builder (`buildFollowingFeedResponse`) and the strict
 * response schema (`followingFeedResponseSchemaStrict`) must stay in sync. If a
 * future edit adds an extra top-level field to the route's payload without
 * updating the schema, the first test fails — surfacing as a `JEST_TEST_FAILURE`
 * diagnostic in the `pnpm check` envelope. That closes the OODA loop for
 * Acceptance Scenario 1 (typed API drift) from `specs/ooda-harness.md`.
 */
describe('API contract drift detection', () => {
  it('route response builder output matches strict schema', () => {
    const result = buildFollowingFeedResponse({
      casts: [{ hash: '0x1' }],
      next: { cursor: 'abc' },
    });
    expect(followingFeedResponseSchemaStrict.safeParse(result).success).toBe(true);
  });

  it('drifted output (extra top-level field) fails strict schema', () => {
    const drifted = {
      ...buildFollowingFeedResponse({ casts: [], next: {} }),
      extraField: 'unexpected',
    };
    expect(followingFeedResponseSchemaStrict.safeParse(drifted).success).toBe(false);
  });
});
