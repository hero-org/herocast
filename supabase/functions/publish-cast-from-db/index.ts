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

function convertCastAddBodyFromDbToHub(castAddBody: any) {
  if (castAddBody.embeds) {
    castAddBody.embeds.forEach((embed) => {
      if ('castId' in embed) {
        embed.castId = {
          fid: embed.castId.fid,
          hash: new Uint8Array(embed?.castId?.hash.split(',').map((x: string) => parseInt(x))),
        };
      }
    });
  }

  return castAddBody;
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
  castAddBody = convertCastAddBodyFromDbToHub(castAddBody);
  const axiosInstance = axios.create({
    headers: { api_key: Deno.env.get('NEYNAR_API_KEY') },
  });
  const writeClient = new HubRestAPIClient({
    hubUrl: 'https://hub-api.neynar.com',
    axiosInstance,
  });
  const publishCastResponse = await writeClient.submitCast(castAddBody, fid, signerPrivateKey);
  console.log(`new cast hash: ${publishCastResponse.hash}`);
  return publishCastResponse.hash;
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
