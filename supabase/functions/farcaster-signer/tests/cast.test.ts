/**
 * Cast Endpoint Integration Tests
 *
 * Tests for POST /cast and DELETE /cast endpoints.
 * These tests require:
 * - A running local Supabase instance
 * - Test users with active accounts
 * - Hub connectivity for full E2E testing
 *
 * Run with: deno test --allow-net --allow-env tests/cast.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getTestConfig,
  signInTestUser,
  makeRequest,
  expectError,
  expectSuccess,
  getTestAccountId,
  generateIdempotencyKey,
  TestUser,
  SKIP_NO_ACCOUNT,
} from './helpers.ts';

const config = getTestConfig();

// Test user - must have an active account with valid FID
const TEST_USER = {
  email: 'test-user-1@herocast.test',
  password: 'test-password-123',
};

// Cache authenticated user to avoid repeated sign-ins
let cachedAuth: { user: TestUser; accountId: string } | null | undefined = undefined;

async function getAuth(): Promise<{ user: TestUser; accountId: string } | null> {
  if (cachedAuth !== undefined) {
    return cachedAuth;
  }

  try {
    const user = await signInTestUser(config, TEST_USER.email, TEST_USER.password);
    const accountId = await getTestAccountId(config, user.accessToken!);
    cachedAuth = accountId ? { user, accountId } : null;
  } catch {
    cachedAuth = null;
  }

  return cachedAuth;
}

// =============================================================================
// Validation Tests (don't hit Hub)
// =============================================================================

Deno.test('Cast - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { text: 'Test cast without account_id' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Missing text returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Empty text returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, text: '' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Text exceeding 1024 chars returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, text: 'x'.repeat(1025) },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Invalid account_id format returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: 'not-a-valid-uuid', text: 'Test cast' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Both channel_id and parent_url returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: {
      account_id: auth.accountId,
      text: 'Test cast',
      channel_id: 'farcaster',
      parent_url: 'https://farcaster.group/farcaster',
    },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - More than 2 embeds returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: {
      account_id: auth.accountId,
      text: 'Test cast',
      embeds: [{ url: 'https://example.com/1' }, { url: 'https://example.com/2' }, { url: 'https://example.com/3' }],
    },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Invalid embed format returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: {
      account_id: auth.accountId,
      text: 'Test cast',
      embeds: [{ invalid_field: 'not valid' }],
    },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Cast - Invalid parent_cast_id hash format returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: {
      account_id: auth.accountId,
      text: 'Test reply',
      parent_cast_id: { fid: 12345, hash: 'not-a-valid-hex-hash' },
    },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// DELETE /cast Validation Tests
// =============================================================================

Deno.test('Delete Cast - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { cast_hash: '0xabcdef1234567890' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Delete Cast - Missing cast_hash returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Delete Cast - Invalid cast_hash format returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/cast', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, cast_hash: 'not-a-valid-hash' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// E2E Tests (hit actual Hub - skip if no Hub available)
// =============================================================================

Deno.test({
  name: 'Cast - E2E: Create and verify cast response structure',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    const response = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: { account_id: auth.accountId, text: `Integration test cast ${Date.now()}` },
    });

    if (response.status === 502) {
      const data = await response.json(); // Consumes body to prevent leak
      assertEquals(data.error.code, 'HUB_SUBMISSION_FAILED');
      console.log('Hub not available, cast validation passed but submission failed');
      return;
    }

    const data = await expectSuccess(response);
    assertEquals(data.success, true);
    assertExists(data.hash);
    assertEquals(typeof data.hash, 'string');
    assertEquals(data.hash.startsWith('0x'), true);
  },
});

Deno.test({
  name: 'Cast - E2E: Idempotency key prevents duplicate posts',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const idempotencyKey = generateIdempotencyKey();

    const response1 = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: { account_id: auth.accountId, text: `Idempotency test ${Date.now()}` },
    });

    if (response1.status === 502) {
      await response1.text(); // Consume body to prevent leak
      console.log('Hub not available, skipping idempotency test');
      return;
    }

    const data1 = await expectSuccess(response1);

    const response2 = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: { account_id: auth.accountId, text: `Different text ${Date.now()}` },
    });

    const data2 = await expectSuccess(response2);
    assertEquals(data1.hash, data2.hash);
  },
});

Deno.test({
  name: 'Cast - E2E: Create cast with channel_id',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: { account_id: auth.accountId, text: `Channel test ${Date.now()}`, channel_id: 'farcaster' },
    });

    if (response.status === 400) {
      const data = await response.json();
      console.log('Channel resolution failed:', data.error.message);
      return;
    }

    if (response.status === 502) {
      await response.text(); // Consume body to prevent leak
      console.log('Hub not available');
      return;
    }

    const data = await expectSuccess(response);
    assertExists(data.hash);
  },
});

Deno.test({
  name: 'Cast - E2E: Create cast with URL embed',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: {
        account_id: auth.accountId,
        text: `Embed test ${Date.now()}`,
        embeds: [{ url: 'https://example.com' }],
      },
    });

    if (response.status === 502) {
      await response.text(); // Consume body to prevent leak
      console.log('Hub not available');
      return;
    }

    const data = await expectSuccess(response);
    assertExists(data.hash);
  },
});

Deno.test({
  name: 'Cast - E2E: Create cast with quote cast embed',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/cast', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: {
        account_id: auth.accountId,
        text: `Quote test ${Date.now()}`,
        embeds: [{ cast_id: { fid: 3, hash: '0xa896906a5e397b4fec247c3ee0e9e4d4990b8ecd' } }],
      },
    });

    if (response.status === 502) {
      await response.text(); // Consume body to prevent leak
      console.log('Hub not available');
      return;
    }

    const data = await expectSuccess(response);
    assertExists(data.hash);
  },
});
