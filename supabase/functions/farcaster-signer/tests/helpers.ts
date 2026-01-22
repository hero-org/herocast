/**
 * Test helpers for Farcaster Signing Service integration tests
 *
 * These tests run against a local Supabase instance.
 * Prerequisites:
 *   1. supabase start
 *   2. supabase functions serve farcaster-signer --no-verify-jwt
 *   3. Test data created via test-setup.sql
 */

// Try to load environment from .env.local if available (optional)
try {
  const { loadSync } = await import("https://deno.land/std@0.224.0/dotenv/mod.ts");
  loadSync({ export: true, allowEmptyValues: true });
} catch {
  // Ignore dotenv errors - env vars should be set directly
}

export interface TestConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  functionUrl: string;
}

export interface TestUser {
  email: string;
  password: string;
  accessToken?: string;
  userId?: string;
}

// Skip message for tests requiring an account
export const SKIP_NO_ACCOUNT = "Skipping: Test user has no active account";

export interface TestAccount {
  id: string;
  fid: number;
  username: string;
}

/**
 * Get test configuration from environment
 */
export function getTestConfig(): TestConfig {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("LOCAL_SUPABASE_ANON_KEY") || "";

  if (!supabaseAnonKey) {
    throw new Error(
      "SUPABASE_ANON_KEY or LOCAL_SUPABASE_ANON_KEY must be set. " +
      "Run 'supabase status' to get your local anon key."
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    functionUrl: `${supabaseUrl}/functions/v1/farcaster-signer`,
  };
}

/**
 * Sign in a test user and get access token
 */
export async function signInTestUser(
  config: TestConfig,
  email: string,
  password: string
): Promise<TestUser> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to sign in test user ${email}: ${error}`);
  }

  const data = await response.json();
  return {
    email,
    password,
    accessToken: data.access_token,
    userId: data.user?.id,
  };
}

/**
 * Create a test user if it doesn't exist
 */
export async function createTestUser(
  config: TestConfig,
  email: string,
  password: string
): Promise<TestUser> {
  // Try to sign up
  const signUpResponse = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (signUpResponse.ok) {
    // New user created, sign in to get token
    return await signInTestUser(config, email, password);
  }

  // User might already exist, try to sign in
  return await signInTestUser(config, email, password);
}

/**
 * Make an authenticated request to the signing service
 */
export async function makeRequest(
  config: TestConfig,
  path: string,
  options: {
    method: "POST" | "DELETE";
    accessToken: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const url = `${config.functionUrl}${path}`;

  return await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${options.accessToken}`,
      "apikey": config.supabaseAnonKey,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Parse response and assert success
 */
export async function expectSuccess<T = Record<string, unknown>>(
  response: Response
): Promise<T & { success: true }> {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      `Expected success but got ${response.status}: ${JSON.stringify(data, null, 2)}`
    );
  }

  return data as T & { success: true };
}

/**
 * Parse response and assert error
 */
export async function expectError(
  response: Response,
  expectedStatus: number,
  expectedCode?: string
): Promise<{ success: false; error: { code: string; message: string } }> {
  const data = await response.json();

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.status}: ${JSON.stringify(data, null, 2)}`
    );
  }

  if (data.success !== false) {
    throw new Error(`Expected error response but got success: ${JSON.stringify(data, null, 2)}`);
  }

  if (expectedCode && data.error?.code !== expectedCode) {
    throw new Error(
      `Expected error code ${expectedCode} but got ${data.error?.code}: ${JSON.stringify(data, null, 2)}`
    );
  }

  return data;
}

/**
 * Generate a unique idempotency key for tests
 */
export function generateIdempotencyKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Wait for a specified time (for rate limit testing, etc.)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get a test account ID for a user (queries database)
 */
export async function getTestAccountId(
  config: TestConfig,
  accessToken: string
): Promise<string | null> {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/accounts?select=id&status=eq.active&limit=1`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "apikey": config.supabaseAnonKey,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const accounts = await response.json();
  return accounts[0]?.id || null;
}
