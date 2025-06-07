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

function convertCastAddBodyFromDbToHub(draftData: any) {
  console.log('Converting draft data to Hub format. Input:', JSON.stringify(draftData, null, 2));

  // Check if data is already in Hub format (has expected Hub fields)
  const hasHubFormat =
    draftData.hasOwnProperty('text') &&
    draftData.hasOwnProperty('mentions') &&
    draftData.hasOwnProperty('mentionsPositions') &&
    !draftData.hasOwnProperty('rawText'); // rawText indicates presentation format

  if (hasHubFormat) {
    console.log('Data appears to be in Hub format, applying minimal conversion...');

    let processedEmbeds = (draftData.embeds || []).map((embed: any) => {
      if (embed.castId) {
        return {
          castId: {
            fid: embed.castId.fid,
            hash:
              typeof embed.castId.hash === 'string'
                ? stringHashToUint(embed.castId.hash)
                : Array.isArray(embed.castId.hash)
                  ? new Uint8Array(embed.castId.hash)
                  : new Uint8Array(embed.castId.hash.split(',').map((x: string) => parseInt(x))),
          },
        };
      }
      if (embed.url) {
        return { url: embed.url };
      }
      return embed;
    });

    // Auto-detect URLs in text if no embeds exist but URLs are present
    if (processedEmbeds.length === 0 && draftData.text) {
      const detectedUrls = extractUrlsFromText(draftData.text);
      console.log('Auto-detected URLs in text:', detectedUrls);
      processedEmbeds = detectedUrls.map((url) => ({ url }));
    }

    return {
      ...draftData,
      embeds: processedEmbeds,
      embedsDeprecated: draftData.embedsDeprecated || [],
    };
  }

  console.log('Data appears to be in presentation format, converting to Hub format...');

  // Handle the case where draft data is in presentation format
  const {
    text,
    rawText,
    embeds = [],
    mentions = [],
    mentionsPositions = [],
    parentCastFid,
    parentCastHash,
    parentUrl,
  } = draftData;

  // Use rawText if available, otherwise fall back to text
  const finalText = rawText || text || '';

  // Process embeds
  let processedEmbeds = embeds.map((embed: any) => {
    if (embed.castId) {
      return {
        castId: {
          fid: embed.castId.fid,
          hash:
            typeof embed.castId.hash === 'string'
              ? stringHashToUint(embed.castId.hash)
              : Array.isArray(embed.castId.hash)
                ? new Uint8Array(embed.castId.hash)
                : new Uint8Array(embed.castId.hash.split(',').map((x: string) => parseInt(x))),
        },
      };
    }
    if (embed.url) {
      return { url: embed.url };
    }
    return embed;
  });

  // Auto-detect URLs in text if no embeds exist but URLs are present
  if (processedEmbeds.length === 0 && finalText) {
    const detectedUrls = extractUrlsFromText(finalText);
    console.log('Auto-detected URLs in text:', detectedUrls);
    processedEmbeds = detectedUrls.map((url) => ({ url }));
  }

  // Process parent cast if provided
  const parentCastId =
    parentCastFid && parentCastHash
      ? {
          fid: parentCastFid,
          hash: typeof parentCastHash === 'string' ? stringHashToUint(parentCastHash) : parentCastHash,
        }
      : undefined;

  // Build the final cast body in Hub format
  const hubCastBody = {
    text: finalText,
    mentions: mentions || [],
    mentionsPositions: mentionsPositions || [],
    embeds: processedEmbeds,
    embedsDeprecated: [],
    ...(parentCastId ? { parentCastId } : {}),
    ...(parentUrl ? { parentUrl } : {}),
  };

  console.log('Converted to Hub format:', JSON.stringify(hubCastBody, null, 2));
  return hubCastBody;
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

  const axiosInstance = axios.create({
    headers: { api_key: Deno.env.get('NEYNAR_API_KEY') },
  });
  const writeClient = new HubRestAPIClient({
    hubUrl: 'https://snapchain-api.neynar.com',
    axiosInstance,
  });

  try {
    const publishCastResponse = await writeClient.submitCast(castAddBody, fid, signerPrivateKey);
    console.log(`new cast hash: ${publishCastResponse.hash}`);
    return publishCastResponse.hash;
  } catch (error) {
    console.error('Full error object:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.request) {
      console.error(
        'Request config:',
        JSON.stringify(
          {
            url: error.request.url,
            method: error.request.method,
            headers: error.request.headers,
            data: error.request.data,
          },
          null,
          2
        )
      );
    }

    throw error;
  }
}

const publishDraft = async (supabaseClient, draftId) => {
  return Sentry.withScope(async (scope) => {
    scope.setTag('draftId', draftId);

    const { data: drafts, error: getDraftError } = await supabaseClient.from('draft').select('*').eq('id', draftId);

    if (getDraftError || drafts?.length !== 1) {
      const errorMessage = getDraftError || `no draft returned for id ${draftId}`;
      console.error(errorMessage);
      Sentry.captureException(new Error(errorMessage));
      return;
    }
    const draft = drafts?.[0];
    if (draft.status !== 'scheduled') {
      console.error(`draft ${draftId} is not scheduled`);
      return;
    }

    const { data: accounts, error: getAccountError } = await supabaseClient
      .from('decrypted_accounts')
      .select('id, platform_account_id, decrypted_private_key')
      .eq('id', draft.account_id);

    if (getAccountError || accounts?.length !== 1) {
      console.error(getAccountError || `no account returned for id ${draft.account_id}`);
      return;
    }

    const { error: updateDraftStatusError } = await supabaseClient
      .from('draft')
      .update({ status: 'publishing' })
      .select('id')
      .eq('id', draftId);

    if (updateDraftStatusError) {
      console.error(`Failed to update draft status to publishing for id ${draftId}: ${updateDraftStatusError}`);
      return;
    }

    try {
      const castBody = draft.data;
      const account = accounts[0];

      console.log('submit draft to protocol - draftId:', draftId);
      console.log('account fid:', Number(account.platform_account_id));
      console.log('draft data structure:', JSON.stringify(castBody, null, 2));

      await submitMessage({
        fid: Number(account.platform_account_id),
        signerPrivateKey: account.decrypted_private_key,
        castAddBody: castBody,
      });

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
      await supabaseClient.from('draft').update({ status: 'failed' }).select('id').eq('id', draftId);
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
