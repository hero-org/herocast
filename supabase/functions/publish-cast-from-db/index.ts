import { createClient } from '@supabase/supabase-js';
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

function stringHashToUint(hashString: string): Uint8Array {
  return new Uint8Array(Buffer.from(hashString.slice(2), 'hex'));
}

function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[0]);
  }

  return urls;
}

function validateAndCleanCastData(castData: any) {
  // Ensure all required fields exist and are the correct type
  const cleanedData = {
    text: String(castData.text || ''),
    mentions: Array.isArray(castData.mentions) ? castData.mentions.filter((m) => Number.isInteger(m)) : [],
    mentionsPositions: Array.isArray(castData.mentionsPositions)
      ? castData.mentionsPositions.filter((p) => Number.isInteger(p))
      : [],
    embeds: Array.isArray(castData.embeds) ? castData.embeds : [],
    embedsDeprecated: [],
  };

  // Validate text length (Farcaster limit is 320 bytes)
  const textBytes = new TextEncoder().encode(cleanedData.text);
  if (textBytes.length > 320) {
    throw new Error(`Text too long: ${textBytes.length} bytes (max 320)`);
  }

  // Validate mentions and positions match
  if (cleanedData.mentions.length !== cleanedData.mentionsPositions.length) {
    console.warn('Mentions and mentionsPositions length mismatch, clearing both');
    cleanedData.mentions = [];
    cleanedData.mentionsPositions = [];
  }

  // Validate embeds format
  cleanedData.embeds = cleanedData.embeds
    .map((embed) => {
      if (embed.url && typeof embed.url === 'string') {
        return { url: embed.url };
      }
      if (embed.castId && embed.castId.fid && embed.castId.hash) {
        return {
          castId: {
            fid: Number(embed.castId.fid),
            hash:
              embed.castId.hash instanceof Uint8Array
                ? embed.castId.hash
                : typeof embed.castId.hash === 'string'
                  ? stringHashToUint(embed.castId.hash)
                  : Array.isArray(embed.castId.hash)
                    ? new Uint8Array(embed.castId.hash)
                    : new Uint8Array(),
          },
        };
      }
      console.warn('Invalid embed format, skipping:', embed);
      return null;
    })
    .filter(Boolean);

  // Limit embeds to max allowed
  if (cleanedData.embeds.length > 2) {
    console.warn('Too many embeds, truncating to 2');
    cleanedData.embeds = cleanedData.embeds.slice(0, 2);
  }

  return cleanedData;
}

function convertCastAddBodyFromDbToHub(draftData: any) {
  console.log('Converting draft data to Hub format. Input:', JSON.stringify(draftData, null, 2));

  // For the specific draft format provided, extract the text and detect URLs
  const text = draftData.text || draftData.rawText || '';
  const mentions = draftData.mentions || [];
  const mentionsPositions = draftData.mentionsPositions || [];
  let embeds = draftData.embeds || [];

  // Auto-detect URLs in text if no embeds exist but URLs are present
  if (embeds.length === 0 && text) {
    const detectedUrls = extractUrlsFromText(text);
    console.log('Auto-detected URLs in text:', detectedUrls);
    embeds = detectedUrls.map((url) => ({ url }));
  }

  // Build the basic format
  const basicCastBody = {
    text: text,
    mentions: mentions,
    mentionsPositions: mentionsPositions,
    embeds: embeds,
    embedsDeprecated: [],
  };

  // Validate and clean the data
  const hubCastBody = validateAndCleanCastData(basicCastBody);

  console.log('Converted to Hub format:', JSON.stringify(hubCastBody, null, 2));
  console.log('Text byte length:', new TextEncoder().encode(hubCastBody.text).length);
  console.log('Mentions count:', hubCastBody.mentions.length);
  console.log('Embeds count:', hubCastBody.embeds.length);

  return hubCastBody;
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

async function submitWithAlternativeApproach({
  fid,
  signerPrivateKey,
  castAddBody,
}: {
  fid: number;
  signerPrivateKey: string;
  castAddBody: any;
}): Promise<string> {
  console.log('=== USING ALTERNATIVE APPROACH ===');
  console.log('FID:', fid);
  console.log('Cast body:', JSON.stringify(castAddBody, null, 2));

  // Try multiple hub endpoints with different configurations
  const hubEndpoints = ['https://hub-api.neynar.com', 'https://snapchain-api.neynar.com', 'https://hub.pinata.cloud'];

  let lastError;

  for (const hubUrl of hubEndpoints) {
    try {
      console.log(`Trying hub endpoint: ${hubUrl}`);

      const axiosInstance = axios.create({
        headers: {
          api_key: Deno.env.get('NEYNAR_API_KEY'),
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const writeClient = new HubRestAPIClient({
        hubUrl,
        axiosInstance,
      });

      // Clean private key format
      let cleanPrivateKey = signerPrivateKey;
      if (signerPrivateKey.startsWith('0x')) {
        cleanPrivateKey = signerPrivateKey.slice(2);
      }

      // Ensure exactly 64 hex characters
      if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
        console.log(`Invalid key format for ${hubUrl}, skipping...`);
        continue;
      }

      console.log(`Attempting submitCast with ${hubUrl}...`);
      const result = await writeClient.submitCast(castAddBody, fid, cleanPrivateKey);
      console.log(`SUCCESS with hub: ${hubUrl}, hash: ${result.hash}`);
      return result.hash;
    } catch (error) {
      console.log(`Hub ${hubUrl} failed:`, error.response?.data?.error_detail || error.message);
      lastError = error;
      continue;
    }
  }

  console.error('All hub endpoints failed. Last error:', lastError?.response?.data || lastError?.message);
  throw lastError;
}

async function submitMessage({
  fid,
  signerPrivateKey,
  castAddBody,
}: {
  fid: number;
  signerPrivateKey: string;
  castAddBody: any;
}): Promise<string> {
  console.log('Original castAddBody from DB:', JSON.stringify(castAddBody, null, 2));

  castAddBody = convertCastAddBodyFromDbToHub(castAddBody);
  console.log('Converted castAddBody for Hub:', JSON.stringify(castAddBody, null, 2));

  try {
    // Try alternative hub endpoints approach
    console.log('Attempting alternative hub endpoints...');
    return await submitWithAlternativeApproach({ fid, signerPrivateKey, castAddBody });
  } catch (error) {
    console.error('All alternative approaches failed');
    console.error('Final error:', error.response?.data || error.message);
    throw error;
  }
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
      .select('id, platform_account_id, decrypted_private_key')
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

        // Fallback to the current approach for existing drafts
        await submitMessage({
          fid: Number(account.platform_account_id),
          signerPrivateKey: account.decrypted_private_key,
          castAddBody: castBody,
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
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

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
