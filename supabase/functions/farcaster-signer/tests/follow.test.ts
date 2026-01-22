/**
 * Follow Endpoint Integration Tests
 *
 * Tests for POST /follow and DELETE /follow endpoints.
 *
 * Run with: deno test --allow-net --allow-env tests/follow.test.ts
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

// A known FID to follow for tests
const TEST_TARGET_FID = 3; // dwr.eth

// =============================================================================
// POST /follow Validation Tests
// =============================================================================

Deno.test('Follow - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { target_fid: TEST_TARGET_FID },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Follow - Missing target_fid returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Follow - Invalid target_fid (negative) returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target_fid: -1 },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Follow - Invalid target_fid (zero) returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target_fid: 0 },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Follow - Invalid target_fid (float) returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target_fid: 3.14 },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Follow - Invalid target_fid (string) returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'POST',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId, target_fid: 'not-a-number' },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// DELETE /follow Validation Tests
// =============================================================================

Deno.test('Unfollow - Missing account_id returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { target_fid: TEST_TARGET_FID },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

Deno.test('Unfollow - Missing target_fid returns 400', async () => {
  const auth = await getAuth();
  if (!auth) {
    console.log(SKIP_NO_ACCOUNT);
    return;
  }

  const response = await makeRequest(config, '/follow', {
    method: 'DELETE',
    accessToken: auth.user.accessToken!,
    body: { account_id: auth.accountId },
  });

  const data = await expectError(response, 400, 'INVALID_MESSAGE');
  assertExists(data.error.message);
});

// =============================================================================
// E2E Tests
// =============================================================================

Deno.test({
  name: 'Follow - E2E: Follow a user',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/follow', {
      method: 'POST',
      accessToken: auth.user.accessToken!,
      body: { account_id: auth.accountId, target_fid: TEST_TARGET_FID },
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
  name: 'Follow - E2E: Unfollow a user',
  ignore: Deno.env.get('SKIP_E2E_TESTS') === 'true',
  fn: async () => {
    const auth = await getAuth();
    if (!auth) {
      console.log(SKIP_NO_ACCOUNT);
      return;
    }

    const response = await makeRequest(config, '/follow', {
      method: 'DELETE',
      accessToken: auth.user.accessToken!,
      body: { account_id: auth.accountId, target_fid: TEST_TARGET_FID },
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
