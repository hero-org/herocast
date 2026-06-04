/**
 * Unit tests for persistence-verification gating.
 *
 * The Hypersnap castById persistence poll is cast-only — running it for any other
 * message type would false-fail (castById can't resolve reactions/links/user-data/
 * cast-removes). These lock that gating in.
 *
 * Run with: deno test --config deno.json tests/verify-persistence.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { MessageType } from '@farcaster/core';
import { shouldVerifyPersistence } from '../lib/sign.ts';

Deno.test('verifies persistence for Hypersnap CastAdd', () => {
  assertEquals(shouldVerifyPersistence('hypersnap', MessageType.CAST_ADD), true);
});

Deno.test('skips verification for Hypersnap non-cast writes (castById cannot resolve them)', () => {
  const nonCast = [
    MessageType.CAST_REMOVE,
    MessageType.REACTION_ADD,
    MessageType.REACTION_REMOVE,
    MessageType.LINK_ADD,
    MessageType.LINK_REMOVE,
    MessageType.USER_DATA_ADD,
  ];
  for (const type of nonCast) {
    assertEquals(shouldVerifyPersistence('hypersnap', type), false, `expected skip for MessageType ${type}`);
  }
});

Deno.test('never verifies for Neynar (multi-host, trusts the hub 200)', () => {
  assertEquals(shouldVerifyPersistence('neynar', MessageType.CAST_ADD), false);
  assertEquals(shouldVerifyPersistence('neynar', MessageType.REACTION_ADD), false);
});

Deno.test('skips verification when the message type is unknown/undefined', () => {
  assertEquals(shouldVerifyPersistence('hypersnap', undefined), false);
});
