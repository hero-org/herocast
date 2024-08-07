// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js";
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
// import { Analytics } from "@/common/types/types";
import { Database } from '../_shared/db.ts';
import { buildAnalyticsQuery, getCastsOverview } from "../_shared/queryHelpers.ts";
import Pool from 'pg-pool'

import {
  Kysely,
  PostgresDialect,
} from 'kysely'

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

Sentry.setTag('region', Deno.env.get('SB_REGION'));
Sentry.setTag('execution_id', Deno.env.get('SB_EXECUTION_ID'));

console.log("Hello from create analytics data")

const dbUrl = Deno.env.get('DATABASE_URL')
const sslCert = Deno.env.get('DATABASE_SSL_CERT')
if (!dbUrl || !sslCert) {
  console.error("DATABASE_URL or DATABASE_SSL_CERT is not set");
  Deno.exit(1);
}


Deno.serve(async (req) => {
  return Sentry.withScope(async (scope) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok')
    }
    const { fid } = await req.json()

    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      const sslCertFormatted = sslCert.replace(/\\n/g, '\n');
      const parsedUrl = new URL(dbUrl);
      const pool = new Pool({
        database: parsedUrl.pathname.slice(1),
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port),
        user: parsedUrl.username,
        password: parsedUrl.password,
        // tls: { caCertificates: [sslCertFormatted] },
        ssl: { rejectUnauthorized: true, ca: sslCertFormatted },
      });
      const dialect = new PostgresDialect({ pool })
      const db = new Kysely<Database>({
        dialect,
        log(event) {
          console.log('KYSELY:', event)
        }
      })

      console.log('start getting links data');
      const linksQuery = buildAnalyticsQuery('links', fid, 'target_fid');
      const links = await linksQuery.execute(db);
      const reactionsQuery = buildAnalyticsQuery('reactions', fid, 'target_cast_fid');
      const reactions = await reactionsQuery.execute(db);
      const castsQuery = getCastsOverview(fid);
      const casts = await castsQuery.execute(db);
      const res = {
        links: links.rows,
        reactions: reactions.rows,
        casts: casts.rows
      }
      console.log('test res:', res);

      // Save or update the analytics data
      const { data: existingAnalytics, error: fetchError } = await supabaseClient
        .from('analytics')
        .select()
        .eq('fid', fid)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const analyticsData = {
        fid,
        links: res.links,
        reactions: res.reactions,
        casts: res.casts,
        updated_at: new Date().toISOString(),
      };

      if (existingAnalytics) {
        const { error: updateError } = await supabaseClient
          .from('analytics')
          .update(analyticsData)
          .eq('fid', fid);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('analytics')
          .insert(analyticsData);

        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({ fid, message: 'success', data: res }),
        { headers: { "Content-Type": "application/json" } },
      )
    } catch (error) {
      console.error(error)
      Sentry.captureException(error)
      return new Response('Internal Server Error', { status: 500 })
    }

    // const resultReactions = await getAnalyticsData('reactions', fid, 'target_cast_fid');

    // const analytics: Omit<Analytics, 'follows' | 'casts'> = {
    //     updatedAt: Date.now(),
    //     reactions: {
    //         overview: {
    //             total: parseInt(result[0].total) || 0,
    //             h24: parseInt(result[0].h24) || 0,
    //             d7: parseInt(result[0].d7) || 0,
    //             d30: parseInt(result[0].d30) || 0,
    //         },
    //         aggregated: result[0].aggregated || [],
    //     },
    // };
    // const analytics: Omit<Analytics, 'casts' | 'reactions'> = {
    //     updatedAt: Date.now(),
    //     follows: {
    //         overview: {
    //             total: parseInt(result[0].total) || 0,
    //             h24: parseInt(result[0].h24) || 0,
    //             d7: parseInt(result[0].d7) || 0,
    //             d30: parseInt(result[0].d30) || 0,
    //         },
    //         aggregated: result[0].aggregated || [],
    //     },
    // };
    // console.log('analytics', analytics)

    // tasks:
    // assemble all the crazy data from the DB
    // store it in the analytics table
    // return the fid and a message 

  })
})
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create_analytics_data' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
