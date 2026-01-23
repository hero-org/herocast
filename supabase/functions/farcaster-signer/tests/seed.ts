/**
 * Seed test users and accounts for signing service integration tests.
 *
 * Usage:
 *   SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=... \
 *   deno run --allow-net --allow-env --allow-read tests/seed.ts
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('LOCAL_SUPABASE_ANON_KEY') || '';

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'SUPABASE_ANON_KEY or LOCAL_SUPABASE_ANON_KEY must be set. Run `supabase status --output json` to get your local anon key.'
  );
}

type SeedUser = {
  email: string;
  password: string;
  fid: number;
  publicKey: string;
  privateKey: string;
  name: string;
};

const TEST_USERS: SeedUser[] = [
  {
    email: 'test-user-1@herocast.test',
    password: 'test-password-123',
    fid: 11111,
    publicKey: '0x1111111111111111111111111111111111111111111111111111111111111111',
    privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Test Account 1',
  },
  {
    email: 'test-user-2@herocast.test',
    password: 'test-password-456',
    fid: 22222,
    publicKey: '0x2222222222222222222222222222222222222222222222222222222222222222',
    privateKey: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    name: 'Test Account 2',
  },
];

async function signUp(email: string, password: string): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
}

async function signIn(email: string, password: string): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
}

async function ensureUser(email: string, password: string): Promise<{ accessToken: string; userId: string }> {
  const signUpResponse = await signUp(email, password);
  if (!signUpResponse.ok) {
    await signUpResponse.text();
  }

  const signInResponse = await signIn(email, password);
  if (!signInResponse.ok) {
    const error = await signInResponse.text();
    throw new Error(`Failed to sign in ${email}: ${error}`);
  }

  const data = await signInResponse.json();
  const accessToken = data?.access_token as string | undefined;
  const userId = data?.user?.id as string | undefined;

  if (!accessToken || !userId) {
    throw new Error(`Missing auth data for ${email}`);
  }

  return { accessToken, userId };
}

async function getActiveAccountId(accessToken: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id&status=eq.active&limit=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to query accounts: ${error}`);
  }

  const accounts = await response.json();
  return accounts?.[0]?.id ?? null;
}

async function createAccount(accessToken: string, user: SeedUser): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      platform: 'farcaster',
      public_key: user.publicKey,
      name: user.name,
      status: 'active',
      private_key: user.privateKey,
      platform_account_id: String(user.fid),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create account for ${user.email}: ${error}`);
  }

  const data = await response.json();
  const accountId = data?.[0]?.id as string | undefined;
  if (!accountId) {
    throw new Error(`Account insert did not return an id for ${user.email}`);
  }

  return accountId;
}

async function seedUser(user: SeedUser): Promise<void> {
  const { accessToken } = await ensureUser(user.email, user.password);
  const existingAccountId = await getActiveAccountId(accessToken);

  if (existingAccountId) {
    console.log(`[seed] ${user.email}: active account exists (${existingAccountId})`);
    return;
  }

  const newAccountId = await createAccount(accessToken, user);
  console.log(`[seed] ${user.email}: created account (${newAccountId})`);
}

for (const user of TEST_USERS) {
  await seedUser(user);
}

console.log('[seed] Done');
