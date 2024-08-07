// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js";
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { Database } from '../_shared/db.ts';
import { buildAnalyticsQuery, getCastsOverview } from "../_shared/queryHelpers.ts";
import { corsHeaders } from "../_shared/cors.ts";
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
      return new Response('ok', { headers: corsHeaders })
    }
    let fid;
    try {
      const body = await req.json()
      fid = body.fid;
      if (!fid) {
        throw new Error('FID is required');
      }
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
        ssl: { rejectUnauthorized: true, ca: sslCertFormatted },
      });
      const dialect = new PostgresDialect({ pool })
      const db = new Kysely<Database>({
        dialect,
        log(event) {
          console.log('KYSELY:', event)
        }
      })

      const { error: insertError } = await supabaseClient
        .from('analytics')
        .upsert(
          {
            fid,
            status: 'pending',
          },
          { onConflict: 'fid' }
        );

      if (insertError) throw insertError;

      const linksQuery = buildAnalyticsQuery('links', fid, 'target_fid');
      const links = (await linksQuery.execute(db)).rows?.[0];
      const reactionsQuery = buildAnalyticsQuery('reactions', fid, 'target_cast_fid');
      const reactions = (await reactionsQuery.execute(db)).rows?.[0];
      const castsQuery = getCastsOverview(fid);
      const casts = await castsQuery.execute(db);

      const res = {
        follows: {
          aggregated: links.aggregated,
          overview: {
            total: links.total,
            d7: links.d7,
            h24: links.h24,
          }
        },
        reactions: {
          aggregated: reactions.aggregated,
          overview: {
            total: reactions.total,
            d7: reactions.d7,
            h24: reactions.h24,
          }
        },
        casts: casts.rows
      }

      const { error: upsertError } = await supabaseClient
        .from('analytics')
        .upsert(
          {
            fid,
            data: res,
            status: 'done',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'fid' }
        );

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({ fid, message: 'success' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    } catch (error) {
      console.error(error)
      Sentry.captureException(error)
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      )
    }
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
