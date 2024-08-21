// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

console.log('Hello from updating channels!');

const WARPCAST_CHANNELS_ENDPOINT = 'https://api.warpcast.com/v2/all-channels';

type ChannelType = {
  url: string;
  name: string;
  source: string;
  icon_url: string | null;
  description: string | null;
  data: {
    leadFid?: string | null;
    moderatorFid?: string | null;
    followerCount?: number | null;
  } | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    let newChannels: ChannelType[] = [];
    const resWarpcast = await (
      await fetch(WARPCAST_CHANNELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    ).json();
    const warpcastChannels = resWarpcast?.result?.channels || [];
    console.log('Total nr. of Warpcast channels from API:', warpcastChannels.length);

    newChannels = newChannels.concat(
      warpcastChannels.map((channel: any) => ({
        url: channel.url,
        name: channel.name,
        icon_url: channel.imageUrl,
        source: 'Warpcast',
        description: channel.description || null,
        data:
          channel.leadFid || channel.followerCount || channel.moderatorFid
            ? {
                leadFid: channel.leadFid || undefined,
                moderatorFid: channel.moderatorFid || undefined,
                followerCount: channel.followerCount || undefined,
              }
            : null,
      }))
    );

    // chunk the newChannels array to avoid hitting the 1000 row limit
    for (let i = 0; i < newChannels.length; i += 999) {
      const newChannelsChunk = newChannels.slice(i, i + 999);
      await supabaseClient
        .from('channel')
        .upsert(newChannelsChunk, {
          onConflict: 'url',
          ignoreDuplicates: false,
        })
        .then(({ error }) => {
          if (error) throw error;
        });
    }
    const { count: channelCount } =
      (await supabaseClient.from('channel').select('*', { count: 'exact', head: true })) || 0;

    const message = `${newChannels.length} channels from Warpcast. Total channels in DB: ${channelCount}`;
    const returnData = {
      message,
    };

    return new Response(JSON.stringify(returnData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/update-channels' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
