// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { NeynarAPIClient } from "npm:@neynar/nodejs-sdk";
import { Resend } from 'npm:resend';
import { SearchInterval, runFarcasterCastSearch } from '../_shared/search.ts'
import { getHtmlEmail } from './email.jsx';

console.log("Hello from sending daily emails!")

type Cast = {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NEYNAR_API_KEY = Deno.env.get('NEYNAR_API_KEY');

async function sendEmail(resend, fromAddress: string, toAddress: string, subject: string, listsWithCasts: { listName: string, searchTerm: string, casts: any[] }[]) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not set' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const res = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: subject,
      html: getHtmlEmail({ listsWithCasts })
    })
    if (res?.error) {
      console.error('Error sending email:', JSON.stringify(res));
    }
  } catch (error) {
    console.error('Error sending email:', JSON.stringify(error));
  }
}

async function enrichCastsViaNeynar(neynarClient, casts: Cast[]) {
  try {
    const hashes = casts.map((cast) => cast.hash);
    return (await neynarClient.fetchBulkCasts(hashes)).result.casts;
  } catch (error) {
    console.error('Error fetching casts from Neynar:', error);
    return casts
  }
}

serve(async () => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const resend = new Resend(RESEND_API_KEY);
    const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);


    const { data: profilesWithLists, error: profilesError } = await supabaseClient
      .from('profile')
      .select(`
        user_id,
        email,
        lists:list!inner(*)
      `)
      .not('email', 'is', null)
      .eq('list.contents->enabled_daily_email', true)
      .order('idx', { referencedTable: 'list', ascending: true })

    if (profilesError) {
      throw new Error(`Error fetching profiles with lists: ${profilesError.message}`);
    }

    const baseUrl = Deno.env.get('BASE_URL');
    let count = 0;
    for (const profile of profilesWithLists) {
      if (!profile.email) {
        console.error(`Profile has daily digest activated but no email address set. user id ${profile.id}`);
        continue;
      }

      console.log(`user ${profile.user_id} has ${profile?.lists?.length || 0} lists`)

      const listsWithCasts = await Promise.all(profile.lists.map(async (list) => {
        const casts = await runFarcasterCastSearch({
          searchTerm: list.contents.term,
          filters: { ...list.contents.filters, interval: SearchInterval.d1 },
          limit: 5,
          baseUrl,
        });

        const listName = list.name;

        if (!casts.length) {
          return {
            listName,
            casts: []
          };
        }
        return {
          listName,
          casts: await enrichCastsViaNeynar(neynarClient, casts),
          searchTerm: list.contents.term,
        };
      }));

      const fromAddress = 'hiro@herocast.xyz';
      const toAddress = profile.email;
      await sendEmail(resend, fromAddress, toAddress, 'herocast daily digest', listsWithCasts);
      count++;
    }
    return new Response(JSON.stringify({ message: `sent ${count} emails` }), {
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
// curl -i --location --request POST 'http://localhost:54321/functions/v1/send-daily-email' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
