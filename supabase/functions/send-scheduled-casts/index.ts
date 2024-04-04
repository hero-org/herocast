// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from '@supabase/supabase-js';
// import { Factories, FarcasterNetwork, Message, NobleEd25519Signer } from "https://cdn.jsdelivr.net/npm/@farcaster/core/+esm";
// import { getInsecureHubRpcClient, getSSLHubRpcClient, makeCastAdd, Factories, FarcasterNetwork, Message, NobleEd25519Signer } from "npm:@farcaster/hub-nodejs";
import { toBytes } from "npm:viem";
import { HubRestAPIClient } from "npm:@standard-crypto/farcaster-js-hub-rest";
// import { HubRestAPIClient } from "https://esm.sh/gh/hellno/farcaster-js";
// import { HubRestAPIClient } from "https://cdn.jsdelivr.net/gh/hellno/farcaster-js/packages/farcaster-js-hub-rest/src/index.ts";

console.log("Hello from send-scheduled-casts!")

async function submitMessage({ fid, signerPrivateKey, castAddBody }: { fid: number, signerPrivateKey: string, castAddBody: any }) {
  try {


    // const signer = new NobleEd25519Signer(toBytes(signerPrivateKey))
    // const signer = Factories.Ed25519Signer.build();
    // const signer = new NobleEd25519Signer(toBytes(signerPrivateKey));
    // const client = new HubRestAPIClient();
    const writeClient = new HubRestAPIClient({ hubUrl: 'https://hub.farcaster.standardcrypto.vc:2281' });
    console.log(await writeClient.getHubInfo());
    
    const publishCastResponse = await writeClient.submitCast(castAddBody, fid, signerPrivateKey);
    console.log(`new cast hash: ${publishCastResponse.hash}`);

    // const cast = await makeCastAdd(
    //   {
    //     text: "Hello world (scheduled, from the past)",
    //     embeds: [],
    //     embedsDeprecated: [],
    //     mentions: [],
    //     mentionsPositions: [],
    //     parentUrl: "https://warpcast.com/~/channel/herocast",
    //   },
    //   { fid, network: FarcasterNetwork.MAINNET },
    //   signer
    // );
    // console.log('cast', cast);

    // const client = getInsecureHubRpcClient(Deno.env.get('NEYNAR_HUB_URL'));
    // console.log('client.info', await client.getInfo({ dbStats: true }));
    // return;
    // [cast].map((castAddResult) => castAddResult.map((castAdd) => client.submitMessage(castAdd)));

    // console.log(`Submitted the cast to network`);
    // const createdCast = cast._unsafeUnwrap();
    // console.log('createdCast', createdCast);
  } catch (e) {
    // handle errors
    console.error("Error submitting message: ", e);
  }
}

const publishFromDraftTable = async (supabaseClient, draftId) => {
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

  // const { error: updateDraftStatusError } = await supabaseClient
  //   .from('draft')
  //   .update({ status: 'publishing' })
  //   .select('id')
  //   .eq('id', draftId)

  // if (updateDraftStatusError) {
  //   console.error(updateDraftStatusError);
  //   return;
  // }

  try {
    const castBody = draft.data;
    const account = accounts[0];
    console.log('publishing cast', castBody, account.platform_account_id)

    await submitMessage({
      fid: Number(account.platform_account_id),
      signerPrivateKey: account.decrypted_private_key,
      castAddBody: castBody,
    })

    // await supabaseClient
    //   .from('draft')
    //   .update({ status: 'published', published_at: new Date().toISOString() })
    //   .select('id')
    //   .eq('id', draftId)

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

    console.log('SUPABASE_URL', Deno.env.get('SUPABASE_URL'));
    const invocationTime = new Date().toISOString();
    const next15Minutes = new Date(Date.now() + 15 * 60000).toISOString();

    const { data: drafts, error } = await supabaseClient
      .from('draft')
      .select('id')
      .eq('status', 'scheduled')
      .gte('scheduled_for', invocationTime)
      // .lte('scheduled_for', next15Minutes)
      .order('scheduled_for', { ascending: true })
      .limit(1);

    if (!drafts || drafts?.length === 0) {
      console.error(`No drafts to publish between: ${invocationTime} and ${next15Minutes}`);
      return new Response("ok", {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Drafts to publish between: ${invocationTime} and ${next15Minutes}:`, drafts, error);
    for (const draft of drafts) {
      await publishFromDraftTable(supabaseClient, draft.id);
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



// todo:
// - where does the rando parentCastId come from?!?!?!?
//  - is it in the draft table? no
//  - is it from castAdd?
//  - is it from the bytes wrangling/converting? 


// run 
// supabase functions serve --debug
// and
// curl --request POST 'http://localhost:54321/functions/v1/send-scheduled-casts' \
// --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
// --header 'Content-Type: application/json' \
// --data '{ "name":"Functions" }'



// I tried to use directly GRPC endpoint but it fucking sucks and doesn't work
// then I tried to import in any way directly from @standard-crypto/farcaster-js
// - but it doesnt work by default because it's incompatible with the latest hub-nodejs version
// - I tried to change the import to my github repository where it's fixed -> didn't work correctly in import

// todo:
// -> maybe just add a map to use a downgraded hub-nodejs version so it just compiles in any way
// - brekaing change was the solana version change