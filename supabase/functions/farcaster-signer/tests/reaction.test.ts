/**
 * Reaction Endpoint Integration Tests
 *
 * Tests for POST /reaction and DELETE /reaction endpoints.
 *
 * Run with: deno test --allow-net --allow-env tests/reaction.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getTestConfig,
  signInTestUser,
  makeRequest,
  expectError,
  expectSuccess,
  getTestAccountId,
  TestUser,
  SKIP_NO_ACCOUNT,
} from './helpers.ts';

const config = getTestConfig();

const TEST_USER = {
  email: 'test-user-1@herocast.test',
  password: 'test-password-123',
};

let cachedAuth: { user: TestUser; accountId: string } | null | undefined = undefined;

async function getAuth(): Promise<{ user: TestUser; accountId: string } | null> {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    const user = await signInTestUser(config, TEST_USER.email, TEST_USER.password);
    const accountId = await getTestAccountId(config, user.accessToken!);
    cachedAuth = accountId ? { user, accountId } : null;
  } catch {
    cachedAuth = null;
  }
  return cachedAuth;
}

// A known cast to use for reaction tests
const TEST_TARGET_CAST = { fid: 3, hash: '0xa896906a5e397b4fec247c3ee0e9e4d4990b8ecd' };

// =============================================================================
// POST /reaction Validation Tests
// =============================================================================

Deno.test('Reaction - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { type: 'like', target: TEST_TARGET_CAST },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Reaction - Missing type returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target: TEST_TARGET_CAST },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Reaction - Invalid type returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, type: 'invalid_type', target: TEST_TARGET_CAST },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Reaction - Missing target returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, type: 'like' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Reaction - Invalid target fid returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, type: 'like', target: { fid: -1, hash: '0xabcdef' } },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Reaction - Invalid target hash returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, type: 'like', target: { fid: 3, hash: 'not-hex' } },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// DELETE /reaction Validation Tests
// =============================================================================

Deno.test('Delete Reaction - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { type: 'like', target: TEST_TARGET_CAST },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Delete Reaction - Missing type returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/reaction', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target: TEST_TARGET_CAST },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// E2E Tests
// =============================================================================

Deno.test({
  name: 'Reaction - E2E: Like a cast',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/reaction', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: { account_id: auth.accountId, type: 'like', target: TEST_TARGET_CAST },
    });

    if (response.status === 502) {
      await response.text(); // Consume body to prevent leak
      console.log('Hub not available');
      return;
    }

    const data = await expectSuccess(response);
    assertEquals(data.success, true);
    assertExists(data.hash);
  },
});

Deno.test({
  name: 'Reaction - E2E: Recast a cast',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/reaction', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: { account_id: auth.accountId, type: 'recast', target: TEST_TARGET_CAST },
    });

    if (response.status === 502) {
      await response.text(); // Consume body to prevent leak
      console.log('Hub not available');
      return;
    }

    const data = await expectSuccess(response);
    assertEquals(data.success, true);
    assertExists(data.hash);
  },
});
