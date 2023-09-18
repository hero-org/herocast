// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'

console.log("Hello from updating channels!")

const HYPESHOT_API_ENDPOINT = 'https://www.hypeshot.io/api/getChannels';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    console.log('user is:', user);

    const res = await fetch(HYPESHOT_API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json();
    console.log('Hypeshot data', data.items);

    let insertCount = 0;

    for (const newChannel of data.items) {
      const hasChannelInSupabase = await supabaseClient
        .from('channel')
        .select('*')
        .eq('url', newChannel.parent)
        .then(({ data, error }) => {
          if (error) throw error
          console.log('checking for existing channel', newChannel.parent, 'data', data, error)
          return data.length > 0;
        })

      if (!hasChannelInSupabase) {
        const icon_url = newChannel.token_metadata?.image && newChannel.token_metadata?.itemMediaType == 2 ? newChannel.token_metadata?.image : null;

        await supabaseClient
          .from('channel')
          .insert({
            name: newChannel.channel_name,
            url: newChannel.parent,
            source: 'Hypeshot',
            icon_url,
          })
          .select()
          .then(({ error, data }) => {
            console.log('insert response - data', data, 'error', error);
            if (error) throw error
            insertCount++;
          })
      }
    }

    const message = `found ${data?.count} NFTs, added ${insertCount} channels`;
    console.log(message);
    const returnData = {
      message,
    }

    return new Response(JSON.stringify(returnData), {
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

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
