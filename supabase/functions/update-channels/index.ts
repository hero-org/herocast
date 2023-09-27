// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'

console.log("Hello from updating channels!")

const HYPESHOT_API_ENDPOINT = 'https://www.hypeshot.io/api/getChannels';
const WARPCAST_CHANNELS_JSON = 'https://raw.githubusercontent.com/neynarxyz/farcaster-channels/main/warpcast.json';

type ChannelType = {
  url: string;
  name: string;
  source: string;
  icon_url: string | null;
}

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
    let newChannels: ChannelType[] = [];
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
    newChannels = newChannels.concat(data.items.map((channel: any) => ({
      url: channel.parent,
      name: channel.channel_name,
      icon_url: channel.token_metadata?.image && channel.token_metadata?.itemMediaType == 2 ? channel.token_metadata?.image : null,
      source: `${channel.username} on Hypeshot`,
    })));

    const warpcastChannels = await (await fetch(WARPCAST_CHANNELS_JSON, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })).json();
    newChannels = newChannels.concat(warpcastChannels.map((channel: any) => ({
      url: channel.parent_url,
      name: channel.name || channel.channel_description,
      icon_url: channel.image,
      source: 'Warpcast',
    })));

    let insertCount = 0;
    for (const newChannel of newChannels) {
      const newChannelHasIcon = newChannel.icon_url && newChannel.icon_url.length > 0;
      const existingChannelData = await supabaseClient
        .from('channel')
        .select('*')
        .eq('url', newChannel.url)
        .then(({ data, error }) => {
          if (error) throw error
          console.log('checking for existing channel', newChannel.url, 'data', data, error)
          return data;
        })
      const hasExistingChannel = existingChannelData.length > 0;
      const shouldUpdateChannelInSupabase = !hasExistingChannel || (newChannelHasIcon && existingChannelData[0].icon_url !== newChannel.icon_url);
      if (shouldUpdateChannelInSupabase) {
        await supabaseClient
          .from('channel')
          .upsert({ ...(hasExistingChannel ? existingChannelData[0] : null), ...newChannel })
          .select()
          .then(({ error, data }) => {
            console.log('insert response - data', data, 'error', error);
            if (error) throw error
            insertCount++;
          })
      }
    }

    const message = `from ${newChannels.length} results, added or updated ${insertCount} new channels`;
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
