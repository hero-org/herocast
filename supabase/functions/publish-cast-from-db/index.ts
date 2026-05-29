import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { Message } from 'npm:@farcaster/core@0.14.19';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import { redactHeaders, redactSecrets } from '../_shared/redact.ts';
import { getUserFarcasterProvider, type HubProvider } from '../_shared/userPreferences.ts';

/**
 * Submission timeout for Hub /v1/submitMessage. Matches the signer service
 * (sign.ts HUB_SUBMIT_TIMEOUT_MS). Spike 3 §S3-P1: surface "unknown state"
 * rather than fall back silently.
 */
const HUB_SUBMIT_TIMEOUT_MS = 8000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  // profilesSampleRate is not part of the Deno SDK's DenoOptions type (the Deno
  // Sentry SDK has no profiling support — profiling needs the native
  // @sentry/profiling-node addon, which is unavailable in Deno). The SDK ignores
  // this option at runtime, but we keep it for parity with the other edge
  // functions; the cast is type-only and does not change the runtime object.
  profilesSampleRate: 1.0,
} as Parameters<typeof Sentry.init>[0]);

Sentry.setTag('region', Deno.env.get('SB_REGION'));
Sentry.setTag('execution_id', Deno.env.get('SB_EXECUTION_ID'));

// console.log("Hello from publish-cast-from-db!")

const getSupabaseUrl = () => {
  return Deno.env.get('SUPABASE_URL') || Deno.env.get('API_URL') || Deno.env.get('SUPABASE_API_URL');
};

const getServiceRoleKey = () => {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
};

function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[0]);
  }

  return urls;
}

function ensureHexHash(hash: string): string {
  if (!hash) return hash;
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

function normalizeMentions(draftData: any) {
  const mentions = Array.isArray(draftData?.mentions) ? draftData.mentions.filter((m: number) => Number.isInteger(m)) : [];
  const positionsRaw = Array.isArray(draftData?.mentionsPositions)
    ? draftData.mentionsPositions
    : Array.isArray(draftData?.mentions_positions)
      ? draftData.mentions_positions
      : [];
  const mentionsPositions = positionsRaw.filter((p: number) => Number.isInteger(p));

  if (mentions.length !== mentionsPositions.length) {
    console.warn('Mentions and mentionsPositions length mismatch, clearing both');
    return { mentions: [], mentionsPositions: [] };
  }

  return { mentions, mentionsPositions };
}

function normalizeEmbeds(embeds: any[]): Array<{ url: string } | { cast_id: { fid: number; hash: string } }> {
  return embeds
    .map((embed) => {
      if (embed?.url && typeof embed.url === 'string') {
        return { url: embed.url };
      }

      const castId = embed?.castId || embed?.cast_id;
      if (castId?.fid && castId?.hash) {
        return {
          cast_id: {
            fid: Number(castId.fid),
            hash: ensureHexHash(String(castId.hash)),
          },
        };
      }

      console.warn('Invalid embed format, skipping:', embed);
      return null;
    })
    .filter(Boolean) as Array<{ url: string } | { cast_id: { fid: number; hash: string } }>;
}

function buildSignerPayload(draftData: any) {
  const text = typeof draftData?.text === 'string' ? draftData.text : draftData?.rawText || '';
  let embeds = Array.isArray(draftData?.embeds) ? draftData.embeds : [];

  if (embeds.length === 0 && text) {
    const detectedUrls = extractUrlsFromText(text);
    if (detectedUrls.length) {
      console.log('Auto-detected URLs in text:', detectedUrls);
      embeds = detectedUrls.map((url) => ({ url }));
    }
  }

  const normalizedEmbeds = normalizeEmbeds(embeds);
  const { mentions, mentionsPositions } = normalizeMentions(draftData);
  const parentCastId = draftData?.parentCastId || draftData?.parent_cast_id;
  const parentUrl = draftData?.parentUrl || draftData?.parent_url;

  const payload: Record<string, unknown> = {
    text,
  };

  if (normalizedEmbeds.length) {
    payload.embeds = normalizedEmbeds;
  }

  if (mentions.length) {
    payload.mentions = mentions;
    payload.mentions_positions = mentionsPositions;
  }

  if (parentCastId?.fid && parentCastId?.hash) {
    payload.parent_cast_id = {
      fid: Number(parentCastId.fid),
      hash: ensureHexHash(String(parentCastId.hash)),
    };
  }

  if (parentUrl) {
    payload.parent_url = parentUrl;
  }

  if (draftData?.channel_id) {
    payload.channel_id = draftData.channel_id;
  }

  if (draftData?.cast_type) {
    payload.cast_type = draftData.cast_type;
  }

  return payload;
}

/**
 * Mint a short-lived ES256 JWT that the signer edge function accepts via
 * `supabase.auth.getUser()`. The claim shape matches Supabase's expected
 * user JWT so RLS resolves `auth.uid() = sub`. `source` tags the caller cron;
 * `cron_meta` carries our own bookkeeping (account_id / draft_id) — `scope`
 * is reserved by gotrue's AccessTokenClaims (OAuth 2.0 string).
 *
 * Requires CRON_SIGNING_PRIVATE_JWK env: a JSON-serialized ES256 (P-256)
 * private JWK whose public side is registered in the project's signing-keys
 * (status >= standby) so it appears in `/auth/v1/.well-known/jwks.json`. The
 * `kid` from the JWK is set in the JWT header so gotrue picks the matching
 * verifier.
 */
async function mintUserJwt(
  sub: string,
  cronMeta: Record<string, unknown>,
  source: string
): Promise<string> {
  const privateJwkRaw = Deno.env.get('CRON_SIGNING_PRIVATE_JWK');
  if (!privateJwkRaw) {
    throw new Error('CRON_SIGNING_PRIVATE_JWK missing');
  }
  const jwk = JSON.parse(privateJwkRaw) as JsonWebKey & { kid?: string };
  if (!jwk.kid) {
    throw new Error('CRON_SIGNING_PRIVATE_JWK missing kid');
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  return await create(
    { alg: 'ES256', typ: 'JWT', kid: jwk.kid },
    {
      sub,
      role: 'authenticated',
      aud: 'authenticated',
      source,
      cron_meta: cronMeta,
      iat: getNumericDate(0),
      exp: getNumericDate(60),
    },
    key
  );
}

async function callSignerService(
  path: string,
  body: Record<string, unknown>,
  userJwt: string
): Promise<{ hash: string }> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/API_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/farcaster-signer${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userJwt}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(body),
  });

  let data: { success: boolean; hash?: string; error?: { code: string; message: string } } | null = null;
  try {
    data = (await response.json()) as { success: boolean; hash?: string; error?: { code: string; message: string } };
  } catch {
    // ignore JSON parse errors
  }

  if (!response.ok || !data || data.success === false) {
    const errorMessage = data?.error?.message || `Signer service failed (${response.status})`;
    const errorCode = data?.error?.code;
    throw new Error(errorCode ? `${errorCode}: ${errorMessage}` : errorMessage);
  }

  if (!data.hash) {
    throw new Error('Signer service response missing hash');
  }

  return { hash: data.hash };
}


async function submitPreEncodedMessage({
  encodedMessageBytes,
  provider,
}: {
  encodedMessageBytes: number[];
  provider: HubProvider;
}): Promise<string> {
  console.log('=== USING PRE-ENCODED MESSAGE BYTES ===');
  console.log('Message bytes length:', encodedMessageBytes.length);
  console.log('Provider:', provider);

  const messageBytes = new Uint8Array(encodedMessageBytes);

  // Decode locally to recover the BLAKE3-20 hash before submission.
  // Per Spike 3 §S3-C1, we never trust the Hub response for the hash —
  // we already signed this message, so the hash is known client-side.
  //
  // Message.decode does NOT throw on malformed bytes; it returns a partial
  // message with defaults. The hash field must be exactly BLAKE3-20 bytes,
  // so validate the length to catch garbage payloads before we publish them.
  const decoded = Message.decode(messageBytes);
  if (!decoded.hash || decoded.hash.length !== 20) {
    throw new Error(
      `Pre-encoded message bytes have invalid hash (length=${decoded.hash?.length ?? 0}, expected 20)`
    );
  }
  const localHash = bytesToHex(decoded.hash);

  const hubUrl =
    provider === 'hypersnap' ? 'https://haatz.quilibrium.com' : 'https://snapchain-api.neynar.com';

  // Per Spike 3 §S3-P1: 8s timeout, no cross-provider fallback.
  // On timeout the caller catches and marks the draft as failed; we do NOT
  // retry against the other Hub (the user picked this one).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HUB_SUBMIT_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (provider === 'neynar') {
    headers.api_key = Deno.env.get('NEYNAR_API_KEY') || '';
  }

  console.log('Submitting pre-encoded message bytes to', hubUrl);
  let response: Response;
  try {
    response = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'POST',
      headers,
      body: messageBytes,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(
        `Submission to ${hubUrl} (${provider}) timed out after ${HUB_SUBMIT_TIMEOUT_MS}ms. Status unknown — check the profile before retrying.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorData: { errCode?: string; message?: string };
    try {
      errorData = JSON.parse(errorText) as { errCode?: string; message?: string };
    } catch {
      errorData = { message: errorText };
    }
    throw new Error(errorData.errCode || errorData.message || `HTTP ${response.status}`);
  }

  // Drain body but ignore its shape (Hypersnap and Neynar may differ).
  await response.text().catch(() => '');

  console.log('SUCCESS! Cast hash (local):', localHash);
  return localHash;
}

async function submitViaSignerService({
  accountId,
  draftId,
  draftData,
  userJwt,
}: {
  accountId: string;
  draftId: string;
  draftData: any;
  userJwt: string;
}): Promise<string> {
  console.log('Submitting draft via signer service...');

  const payload = buildSignerPayload(draftData);
  const response = await callSignerService(
    '/cast',
    {
      account_id: accountId,
      idempotency_key: draftId,
      ...payload,
    },
    userJwt
  );

  console.log('Signer service returned hash:', response.hash);
  return response.hash;
}

// supabaseClient is intentionally typed `any` to match the _shared/userPreferences.ts
// helper it is passed to (the typed SupabaseClient is awkward to model across Deno
// import maps — see that file's docstring).
// deno-lint-ignore no-explicit-any
const fixStuckDrafts = async (supabaseClient: any) => {
  console.log('Checking for stuck drafts in publishing status...');

  // Find drafts stuck in publishing status for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stuckDrafts, error } = await supabaseClient
    .from('draft')
    .select('id, status, updated_at')
    .eq('status', 'publishing')
    .lt('updated_at', tenMinutesAgo);

  if (error) {
    console.error('Error finding stuck drafts:', error);
    return;
  }

  if (stuckDrafts && stuckDrafts.length > 0) {
    console.log(`Found ${stuckDrafts.length} stuck drafts, marking as failed...`);

    for (const draft of stuckDrafts) {
      try {
        await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draft.id);
        console.log(`Fixed stuck draft: ${draft.id}`);
      } catch (updateError) {
        console.error(`Failed to fix stuck draft ${draft.id}:`, updateError);
      }
    }
  } else {
    console.log('No stuck drafts found');
  }
};

// deno-lint-ignore no-explicit-any
const publishDraft = async (supabaseClient: any, draftId: string) => {
  return Sentry.withScope(async (scope) => {
    scope.setTag('draftId', draftId);

    // Server-side authorization: SECURITY DEFINER RPC enforces the
    // draft.created_by_user_id == accounts.user_id invariant and draft.status='scheduled'.
    // If it errors or returns zero rows, the draft is not authorized to publish.
    const { data: authRows, error: authError } = await supabaseClient.rpc('authorize_draft_publish', {
      p_draft_id: draftId,
    });

    if (authError || !authRows || authRows.length === 0) {
      console.error('draft publish not authorized', authError);
      Sentry.captureException(authError || new Error(`draft ${draftId} publish not authorized`));
      await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draftId);
      return;
    }

    const { owner_user_id, account_id: authorizedAccountId } = authRows[0] as {
      owner_user_id: string;
      account_id: string;
    };

    const { data: drafts, error: getDraftError } = await supabaseClient
      .from('draft')
      .select('*, encoded_message_bytes')
      .eq('id', draftId);

    if (getDraftError || drafts?.length !== 1) {
      const errorMessage = getDraftError || `no draft returned for id ${draftId}`;
      console.error(errorMessage);
      Sentry.captureException(new Error(errorMessage));
      // Ensure any stuck drafts are marked as failed
      await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draftId);
      return;
    }
    const draft = drafts?.[0];
    if (draft.status !== 'scheduled') {
      console.error(`draft ${draftId} is not scheduled, current status: ${draft.status}`);
      // If it's stuck in publishing, mark as failed
      if (draft.status === 'publishing') {
        console.log(`Marking stuck publishing draft ${draftId} as failed`);
        await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draftId);
      }
      return;
    }

    const { data: accounts, error: getAccountError } = await supabaseClient
      .from('decrypted_accounts')
      .select('id, platform_account_id')
      .eq('id', draft.account_id);

    if (getAccountError || accounts?.length !== 1) {
      console.error(getAccountError || `no account returned for id ${draft.account_id}`);
      await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draftId);
      return;
    }

    const { error: updateDraftStatusError } = await supabaseClient
      .from('draft')
      .update({ status: 'publishing' })
      .select('id')
      .eq('id', draftId);

    if (updateDraftStatusError) {
      console.error(`Failed to update draft status to publishing for id ${draftId}: ${updateDraftStatusError}`);
      await supabaseClient.from('draft').update({ status: 'failed' }).eq('id', draftId);
      return;
    }

    let castBody, account;
    try {
      castBody = draft.data;
      account = accounts[0];

      console.log('submit draft to protocol - draftId:', draftId);
      console.log('account fid:', Number(account.platform_account_id));

      // Read the user-level Hub provider preference at PUBLISH time (not at
      // scheduling time — Spike 3 §11 lock-in). The cron's service-role client
      // bypasses RLS so this read always succeeds for any user.
      const provider = await getUserFarcasterProvider(supabaseClient, owner_user_id);

      // Check if we have pre-encoded message bytes (fast path — no signer call needed)
      if (draft.encoded_message_bytes && Array.isArray(draft.encoded_message_bytes)) {
        console.log('Found pre-encoded message bytes, using reliable submission...');
        await submitPreEncodedMessage({
          encodedMessageBytes: draft.encoded_message_bytes,
          provider,
        });
      } else {
        console.log('No pre-encoded bytes found, using fallback approach...');
        console.log('draft data structure:', JSON.stringify(castBody, null, 2));

        // Mint a 60-second JWT bound to the validated owner + draft scope.
        const userJwt = await mintUserJwt(
          owner_user_id,
          { account_id: authorizedAccountId, draft_id: draftId },
          'cron:publish'
        );

        await submitViaSignerService({
          accountId: draft.account_id,
          draftId,
          draftData: castBody,
          userJwt,
        });
      }

      await supabaseClient
        .from('draft')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .select('id')
        .eq('id', draftId);
      console.log('published draft id:', draftId, 'successfully!');
    } catch (e) {
      const err = e as {
        name?: string;
        message?: string;
        stack?: string;
        response?: {
          status?: unknown;
          statusText?: unknown;
          data?: unknown;
          headers?: Record<string, unknown> | null;
        };
        config?: {
          url?: unknown;
          method?: unknown;
          headers?: Record<string, unknown> | null;
          data?: unknown;
        };
        request?: unknown;
      };
      const errorMessage = `Failed to publish draft id ${draftId}: ${e}`;
      console.error('=== DETAILED ERROR ANALYSIS ===');
      console.error('Draft ID:', draftId);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);

      if (err.response) {
        console.error('=== HTTP RESPONSE ERROR ===');
        console.error('Status:', err.response.status);
        console.error('Status Text:', err.response.statusText);
        console.error('Response Data:', redactSecrets(JSON.stringify(err.response.data, null, 2)));
        console.error('Response Headers:', JSON.stringify(redactHeaders(err.response?.headers), null, 2));
      }

      if (err.config) {
        console.error('=== REQUEST CONFIG ===');
        console.error('URL:', err.config.url);
        console.error('Method:', err.config.method);
        console.error('Headers:', JSON.stringify(redactHeaders(err.config?.headers), null, 2));
        console.error('Request Data:', redactSecrets(JSON.stringify(err.config.data, null, 2)));
      }

      if (err.request && !err.response) {
        console.error('=== REQUEST ERROR (No Response) ===');
        console.error('Request made but no response received');
        console.error('Network error or timeout');
      }

      console.error('=== ORIGINAL DRAFT DATA ===');
      console.error('Cast Body:', JSON.stringify(castBody, null, 2));
      console.error('Account FID:', Number(account.platform_account_id));
      console.error('================================');

      console.error(errorMessage);
      Sentry.captureException(e);

      // CRITICAL: Always ensure draft is marked as failed, with multiple attempts
      try {
        const { error: failUpdateError } = await supabaseClient
          .from('draft')
          .update({
            status: 'failed',
          })
          .eq('id', draftId);
        if (failUpdateError) {
          console.error('CRITICAL: Failed to update draft status to failed:', failUpdateError);
          // Try once more with a direct query
          const { error: retryError } = await supabaseClient
            .from('draft')
            .update({
              status: 'failed',
            })
            .eq('id', draftId);
          if (retryError) {
            console.error('CRITICAL: Second attempt also failed:', retryError);
          } else {
            console.log('Successfully marked draft as failed on retry');
          }
        } else {
          console.log('Successfully marked draft as failed');
        }
      } catch (updateError) {
        console.error('CRITICAL: Exception while updating draft to failed:', updateError);
        // Last resort: log the draft ID for manual cleanup
        console.error(`MANUAL CLEANUP NEEDED: Draft ${draftId} may be stuck in publishing status`);
      }
    }
  });
};

Deno.serve(async (req) => {
  return Sentry.withScope(async (scope) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok');
    }

    try {
      const supabaseUrl = getSupabaseUrl();
      const serviceRoleKey = getServiceRoleKey();

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL/API_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY');
      }

      const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

      const now = new Date();
      now.setSeconds(0, 0); // Round down to the nearest full minute
      const invocationTime = now.toISOString();
      const next5Minutes = new Date(now.getTime() + 5 * 60000 - 1).toISOString();

      const { data: drafts, error } = await supabaseClient
        .from('draft')
        .select('id')
        .eq('status', 'scheduled')
        .gte('scheduled_for', invocationTime)
        .lte('scheduled_for', next5Minutes)
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error(error);
        Sentry.captureException(error);
        return new Response(JSON.stringify({ error: error?.message }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      if (!drafts || drafts?.length === 0) {
        console.log(`No drafts to publish between: ${invocationTime} and ${next5Minutes}`);
        return new Response('ok', {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`Drafts to publish between: ${invocationTime} and ${next5Minutes}:`, drafts.length, error);

      // First, fix any stuck drafts
      await fixStuckDrafts(supabaseClient);

      for (const draft of drafts) {
        await publishDraft(supabaseClient, draft.id);
      }

      return new Response('ok', {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      Sentry.captureException(error);
      return new Response(JSON.stringify({ error: (error as { message?: string })?.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  });
});

// Local invocation:
//   supabase functions serve --debug
//   curl -X POST http://localhost:54321/functions/v1/publish-cast-from-db \
//     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
//     -H "Content-Type: application/json" \
//     --data '{}'
