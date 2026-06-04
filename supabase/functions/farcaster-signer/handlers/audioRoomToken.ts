/**
 * Audio-room token handler for the Farcaster Signing Service.
 *
 * Mints a short-lived Farcaster app-key (Tier 1) JWT that
 * `client.farcaster.xyz` accepts as a session bearer for the audio-room
 * (Spaces) control plane. The mint happens here — server-side, in the
 * edge function — so the Ed25519 signer is NEVER used by browser code and
 * the resulting bearer NEVER reaches the client. The same-origin proxy
 * (`app/api/spaces/[...path]`) is the only consumer of this token.
 *
 * Identity/auth is identical to every other handler in this function: the
 * `decrypted_account` RPC self-filters on `auth.uid()` (see
 * `lib/accounts.ts`), so a caller can only mint for an account they own.
 *
 * SECURITY: never log the token or the signer private key.
 */

import { NobleEd25519Signer } from 'npm:@farcaster/core@0.14.19';
import { getAccountForSigning } from '../lib/accounts.ts';
import { corsHeaders, InvalidRequestError, SigningFailedError } from '../lib/errors.ts';
import type { AuthResult } from '../lib/types.ts';

/** Validity window of a minted bearer (matches the probe: now + 300s). */
const TOKEN_TTL_MS = 300_000;

/** base64url-encode raw bytes (no padding). */
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url-encode a JSON object via its UTF-8 bytes. */
function jsonB64url(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/** Convert a hex string (optional 0x) to bytes. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new InvalidRequestError('Signer private key must be 64 hex chars (32 bytes)');
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Lowercase hex of raw bytes (no 0x). */
function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

/**
 * Build the Tier-1 app-key Ed25519 JWT exactly as the Phase 0 probe does
 * (`.context/spaces-probe/probe.mjs`, variant `key=0xhex · sign=raw`):
 *
 *   header  = { fid, type: 'app_key', key: '0x' + <ed25519 pubkey hex> }
 *   payload = { exp: floor(now/1000) + 300 }
 *   signing input = utf8(`${b64url(header)}.${b64url(payload)}`)
 *   token   = `${signingInput}.${b64url(ed25519_sign(signingInput))}`
 *
 * Implementation note: we sign with `@farcaster/core`'s `NobleEd25519Signer`
 * (the same Ed25519 path the cast/reaction handlers already use, and which
 * runs reliably in the Deno edge runtime). `getSignerKey()` returns the raw
 * 32-byte public key; `signMessageHash(bytes)` is `ed25519.sign(bytes, sk)`,
 * i.e. it signs the input bytes DIRECTLY (no extra pre-hash) — identical to
 * the probe's `crypto.sign(null, input, key)` (`sign=raw`).
 *
 * NOTE: the EXACT shape (key encoding `0xhex` vs `hex` vs `b64url`, and the
 * raw-vs-sha256 signing input) is pending confirmation from the Phase 0
 * probe, which tries four variants. If the probe reveals a different winner,
 * this is the SINGLE function to tweak: change the `key` encoding and/or the
 * `signMessageHash` argument. The default below is the probe's first /
 * most-likely variant.
 */
async function buildAppKeyJwt(fid: number, signerPrivateKeyHex: string): Promise<string> {
  const seed = hexToBytes(signerPrivateKeyHex);
  const signer = new NobleEd25519Signer(seed);

  const pubResult = await signer.getSignerKey();
  if (pubResult.isErr()) {
    throw new SigningFailedError(`Failed to derive signer public key: ${pubResult.error.message}`);
  }
  const pubHex = bytesToHex(pubResult.value);

  const header = { fid, type: 'app_key', key: `0x${pubHex}` };
  const payload = { exp: Math.floor(Date.now() / 1000) + 300 };

  const headerB64 = jsonB64url(header);
  const payloadB64 = jsonB64url(payload);
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // `sign=raw`: sign the utf8 signing input directly (Ed25519's own SHA-512
  // is internal — this matches the probe, which does NOT pre-hash).
  const sigResult = await signer.signMessageHash(signingInput);
  if (sigResult.isErr()) {
    throw new SigningFailedError(`Failed to sign audio-room token: ${sigResult.error.message}`);
  }

  return `${headerB64}.${payloadB64}.${b64url(sigResult.value)}`;
}

interface MintRequestBody {
  account_id?: string;
}

/**
 * Handle POST /audio-room-token — mint an audio-room (Spaces) bearer.
 *
 * Body: `{ account_id }`. Resolves the signer for that account (owner-only
 * via the RPC), builds the app-key JWT, and returns
 * `{ token, expiresAt, scheme }`. The token is the Farcaster session bearer
 * for the audio-room control plane and must stay server-side.
 */
export async function handleMintAudioRoomToken(req: Request, authResult: AuthResult): Promise<Response> {
  const { userId, supabaseClient } = authResult;

  let body: MintRequestBody;
  try {
    body = (await req.json()) as MintRequestBody;
  } catch {
    throw new InvalidRequestError('Invalid JSON body');
  }

  const accountId = body.account_id;
  if (!accountId || typeof accountId !== 'string') {
    throw new InvalidRequestError('Missing account_id');
  }

  // Owner-only resolution: throws ACCOUNT_NOT_FOUND/ACCOUNT_PENDING as needed.
  const account = await getAccountForSigning(supabaseClient, accountId, userId);

  const token = await buildAppKeyJwt(account.fid, account.privateKey);
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  // NOTE: never log `token` or `account.privateKey`.
  return new Response(
    JSON.stringify({
      success: true,
      token,
      expiresAt,
      scheme: 'app_key_jwt',
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // The bearer is short-lived and account-scoped — never cache it.
        'Cache-Control': 'no-store',
      },
    }
  );
}
