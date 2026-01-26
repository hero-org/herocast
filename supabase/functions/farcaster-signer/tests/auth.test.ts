/**
 * Authentication Integration Tests
 *
 * Tests that verify:
 * - Unauthenticated requests are rejected
 * - Invalid tokens are rejected
 * - Valid tokens allow access
 * - Users can only access their own accounts
 *
 * Run with: deno test --allow-net --allow-env tests/auth.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { expectError, getTestAccountId, getTestConfig, makeRequest, signInTestUser } from './helpers.ts';

const config = getTestConfig();

// Test user credentials - these should be created via test-setup.sql
const TEST_USER_1 = {
  email: 'test-user-1@herocast.test',
  password: 'test-password-123',
};

const TEST_USER_2 = {
  email: 'test-user-2@herocast.test',
  password: 'test-password-456',
};

Deno.test('Auth - Missing authorization header returns 401', async () => {
  const response = await fetch(`${config.functionUrl}/cast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabaseAnonKey,
    },
    body: JSON.stringify({
      account_id: '00000000-0000-0000-0000-000000000000',
      text: 'Test cast',
    }),
  });

  // Should get 401 with either MISSING_AUTH_HEADER or INVALID_TOKEN
  // (Supabase runtime may inject anonymous auth)
  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.success, false);
  assertExists(data.error.code);
  assertExists(data.error.message);
});

Deno.test('Auth - Invalid token returns 401', async () => {
  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: 'invalid-token-that-is-definitely-not-valid',
    body: {
      account_id: '00000000-0000-0000-0000-000000000000',
      text: 'Test cast',
    },
  });

  const data = await expectError(response, 401);
  assertEquals(data.success, false);
});

Deno.test('Auth - Expired token returns 401', async () => {
  // This is a valid JWT format but expired
  const expiredToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: expiredToken,
    body: {
      account_id: '00000000-0000-0000-0000-000000000000',
      text: 'Test cast',
    },
  });

  const data = await expectError(response, 401);
  assertEquals(data.success, false);
});

Deno.test('Auth - Valid token with non-existent account returns 404', async () => {
  const user = await signInTestUser(config, TEST_USER_1.email, TEST_USER_1.password);

  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: user.accessToken!,
    body: {
      account_id: '00000000-0000-0000-0000-000000000000', // Non-existent
      text: 'Test cast',
    },
  });

  const data = await expectError(response, 404, 'ACCOUNT_NOT_FOUND');
  assertEquals(data.success, false);
});

Deno.test("Auth - User cannot access another user's account", async () => {
  // Sign in as user 1
  const user1 = await signInTestUser(config, TEST_USER_1.email, TEST_USER_1.password);

  // Sign in as user 2 and get their account ID
  const user2 = await signInTestUser(config, TEST_USER_2.email, TEST_USER_2.password);
  const user2AccountId = await getTestAccountId(config, user2.accessToken!);

  if (!user2AccountId) {
    console.log('Skipping cross-user test: User 2 has no active account');
    return;
  }

  // Try to use user 2's account with user 1's token
  const response = await makeRequest(config, '/cast', {
    method: 'POST',
    accessToken: user1.accessToken!, // User 1's token
    body: {
      account_id: user2AccountId, // User 2's account
      text: 'This should fail',
    },
  });

  // Should get 404 because RLS filters out other users' accounts
  const data = await expectError(response, 404, 'ACCOUNT_NOT_FOUND');
  assertEquals(data.success, false);
});

Deno.test('Auth - CORS preflight returns correct headers', async () => {
  const response = await fetch(`${config.functionUrl}/cast`, {
    method: 'OPTIONS',
  });

  // Consume response body to avoid leak
  await response.text();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'POST, DELETE, OPTIONS');
  assertExists(response.headers.get('Access-Control-Allow-Headers'));
});

Deno.test('Auth - Unknown route returns 404', async () => {
  const user = await signInTestUser(config, TEST_USER_1.email, TEST_USER_1.password);

  const response = await makeRequest(config, '/unknown-route', {
    method: 'POST',
    accessToken: user.accessToken!,
    body: {},
  });

  assertEquals(response.status, 404);
  const data = await response.json();
  assertEquals(data.success, false);
  assertEquals(data.error.code, 'NOT_FOUND');
});
