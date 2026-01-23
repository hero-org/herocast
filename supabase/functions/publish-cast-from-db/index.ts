import { createClient } from 'npm:@supabase/supabase-js@2';
import { HubRestAPIClient } from 'npm:@standard-crypto/farcaster-js-hub-rest';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import axios from 'npm:axios';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

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
  const mentions = Array.isArray(draftData?.mentions) ? draftData.mentions.filter((m) => Number.isInteger(m)) : [];
  const positionsRaw = Array.isArray(draftData?.mentionsPositions)
    ? draftData.mentionsPositions
    : Array.isArray(draftData?.mentions_positions)
      ? draftData.mentions_positions
      : [];
  const mentionsPositions = positionsRaw.filter((p) => Number.isInteger(p));

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

async function callSignerService(path: string, body: Record<string, unknown>): Promise<{ hash: string }> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/API_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/farcaster-signer${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
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

async function submitPreEncodedMessage({ encodedMessageBytes }: { encodedMessageBytes: number[] }): Promise<string> {
  console.log('=== USING PRE-ENCODED MESSAGE BYTES ===');
  console.log('Message bytes length:', encodedMessageBytes.length);

  const messageBytes = new Uint8Array(encodedMessageBytes);

  const axiosInstance = axios.create({
    headers: { api_key: Deno.env.get('NEYNAR_API_KEY') },
  });

  const writeClient = new HubRestAPIClient({
    hubUrl: 'https://snapchain-api.neynar.com',
    axiosInstance,
  });

  console.log('Submitting pre-encoded message bytes...');
  const response = await writeClient.apis.submitMessage.submitMessage({
    body: messageBytes,
  });

  console.log('SUCCESS! Cast hash:', response.data.hash);
  return response.data.hash;
}

async function submitViaSignerService({
  accountId,
  draftId,
  draftData,
}: {
  accountId: string;
  draftId: string;
  draftData: any;
}): Promise<string> {
  console.log('Submitting draft via signer service...');

  const payload = buildSignerPayload(draftData);
  const response = await callSignerService('/cast', {
    account_id: accountId,
    idempotency_key: draftId,
    ...payload,
  });

  console.log('Signer service returned hash:', response.hash);
  return response.hash;
}

const fixStuckDrafts = async (supabaseClient) => {
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

const publishDraft = async (supabaseClient, draftId) => {
  return Sentry.withScope(async (scope) => {
    scope.setTag('draftId', draftId);

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

      // Check if we have pre-encoded message bytes
      if (draft.encoded_message_bytes && Array.isArray(draft.encoded_message_bytes)) {
        console.log('Found pre-encoded message bytes, using reliable submission...');
        await submitPreEncodedMessage({
          encodedMessageBytes: draft.encoded_message_bytes,
        });
      } else {
        console.log('No pre-encoded bytes found, using fallback approach...');
        console.log('draft data structure:', JSON.stringify(castBody, null, 2));

        await submitViaSignerService({
          accountId: draft.account_id,
          draftId,
          draftData: castBody,
        });
      }

      await supabaseClient
        .from('draft')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .select('id')
        .eq('id', draftId);
      console.log('published draft id:', draftId, 'successfully!');
    } catch (e) {
      const errorMessage = `Failed to publish draft id ${draftId}: ${e}`;
      console.error('=== DETAILED ERROR ANALYSIS ===');
      console.error('Draft ID:', draftId);
      console.error('Error name:', e.name);
      console.error('Error message:', e.message);
      console.error('Error stack:', e.stack);

      if (e.response) {
        console.error('=== HTTP RESPONSE ERROR ===');
        console.error('Status:', e.response.status);
        console.error('Status Text:', e.response.statusText);
        console.error('Response Data:', JSON.stringify(e.response.data, null, 2));
        console.error('Response Headers:', JSON.stringify(e.response.headers, null, 2));
      }

      if (e.config) {
        console.error('=== REQUEST CONFIG ===');
        console.error('URL:', e.config.url);
        console.error('Method:', e.config.method);
        console.error('Headers:', JSON.stringify(e.config.headers, null, 2));
        console.error('Request Data:', JSON.stringify(e.config.data, null, 2));
      }

      if (e.request && !e.response) {
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
      return new Response(JSON.stringify({ error: error?.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  });
});

// # run
// supabase functions serve --debug
// # and then
// curl --request POST 'http://localhost:54321/functions/v1/publish-cast-from-db' \
// --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
// --header 'Content-Type: application/json' \
// --data '{ "name":"Functions" }'
