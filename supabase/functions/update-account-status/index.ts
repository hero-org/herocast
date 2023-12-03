// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'

console.log("Hello from Functions!")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      // Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      // { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    // Now we can get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    console.log('user is:', user);

    const { data: accounts, error } = await supabaseClient
      .from('accounts')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', '2023-08-31')
    // .eq('user_id', user?.id)

    if (error) throw error
    console.log('data from select: ', accounts.length, accounts[0].user_id);
    const WARPCAST_API_ENDPOINT = 'https://api.warpcast.com/v2/';

    for (const account of accounts) {
      const signerToken = account.data.signerToken
      const signedKeyRequestData = await (await fetch(`${WARPCAST_API_ENDPOINT}signed-key-request?token=${signerToken}`, { headers: { "Content-Type": "application/json" } })).json();
      const reqResult = signedKeyRequestData.result.signedKeyRequest;
      if (reqResult && (reqResult.state === 'approved' || reqResult.state === 'completed')) {
        console.log('account is', account.name, account.id);
        console.log('success', reqResult)
        supabaseClient
          .from('accounts')
          .update({ status: 'active', platform_account_id: reqResult.userFid, data: reqResult })
          .eq('id', account.id)
          .select()
          .then(({ error, data }) => {
            console.log('response - data', data, 'error', error);
          })

        console.log('only updating one, stopping for now - rls doesnt allow me from updating')
        break;
      }
    }

    console.log('done checking accounts')
    const returnData = {
      message: 'done checking accounts',
    }

    return new Response(JSON.stringify(returnData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
