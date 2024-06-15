import { createClient } from '@supabase/supabase-js';
import { HubRestAPIClient } from "npm:@standard-crypto/farcaster-js";

console.log("Hello from publish-cast-from-db!")

async function submitMessage({ fid, signerPrivateKey, castAddBody }: { fid: number, signerPrivateKey: string, castAddBody: any }): Promise<string> {
  const writeClient = new HubRestAPIClient();
  const publishCastResponse = await writeClient.submitCast(castAddBody, fid, signerPrivateKey);
  console.log(`new cast hash: ${publishCastResponse.hash}`);
  return publishCastResponse.hash;
}

const publishDraft = async (supabaseClient, draftId) => {
  const { data: drafts, error: getDraftError } = await supabaseClient
    .from('draft')
    .select('*')
    .eq('id', draftId);

  if (getDraftError || drafts?.length !== 1) {
    console.error(getDraftError || `no draft returned for id ${draftId}`);
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
    .eq('id', draftId)

  if (updateDraftStatusError) {
    console.error(`Failed to update draft status to publishing for id ${draftId}: ${updateDraftStatusError}`);
    return;
  }

  try {
    const castBody = draft.data;
    const account = accounts[0];

    console.log('submit draft to protocol - draftId:', draftId, 'fid:', account.platform_account_id);
    await submitMessage({
      fid: Number(account.platform_account_id),
      signerPrivateKey: account.decrypted_private_key,
      castAddBody: castBody,
    })

    await supabaseClient
      .from('draft')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .select('id')
      .eq('id', draftId)
    console.log('published draft id:', draftId, 'successfully!');
  } catch (e) {
    console.error(`Failed to publish draft id ${draftId}: ${e}`);
    await supabaseClient
      .from('draft')
      .select('id')
      .update({ status: 'error' })
      .eq('id', draftId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok')
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const invocationTime = new Date().toISOString();
    const next5Minutes = new Date(Date.now() + 5 * 60000).toISOString();

    const { data: drafts, error } = await supabaseClient
      .from('draft')
      .select('id')
      .eq('status', 'scheduled')
      .gte('scheduled_for', invocationTime)
      .lte('scheduled_for', next5Minutes)
      .order('scheduled_for', { ascending: true })

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error?.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!drafts || drafts?.length === 0) {
      console.error(`No drafts to publish between: ${invocationTime} and ${next5Minutes}`);
      return new Response("ok", {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Drafts to publish between: ${invocationTime} and ${next5Minutes}:`, drafts.length, error);
    for (const draft of drafts) {
      await publishDraft(supabaseClient, draft.id);
    }

    return new Response("ok", {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


// # run 
// supabase functions serve --debug
// # and then
// curl --request POST 'http://localhost:54321/functions/v1/send-scheduled-casts' \
// --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
// --header 'Content-Type: application/json' \
// --data '{ "name":"Functions" }'
