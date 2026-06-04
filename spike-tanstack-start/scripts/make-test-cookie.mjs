// Builds a faithfully-encoded @supabase/ssr session cookie to test getUser() without
// real credentials. Uses the SDK's OWN stringToBase64URL so the encoding can't drift
// (base64url + "base64-" sentinel — NOT standard base64).
// Usage: node scripts/make-test-cookie.mjs <projectRef>
import { stringToBase64URL } from '@supabase/ssr';
const ref = process.argv[2] || 'spikedummyproject0000';
const session = {
  access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzcGlrZSJ9.fake-not-a-real-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: 'fake-refresh',
  user: { id: 'spike-user-0001', email: 'spike@example.com' },
};
process.stdout.write(`sb-${ref}-auth-token=base64-${stringToBase64URL(JSON.stringify(session))}`);
