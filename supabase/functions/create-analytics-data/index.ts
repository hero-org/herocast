// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { Database } from '../_shared/db.ts';
import {
  buildAnalyticsQuery,
  formatResponseSection,
  getRecentUnfollows,
  getTopCasts,
} from '../_shared/queryHelpers.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { Kysely, PostgresAdapter, PostgresDialect, PostgresIntrospector, PostgresQueryCompiler, sql } from 'kysely';
// import { Client } from "postgres";
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import { PostgreSQLDriver } from 'https://deno.land/x/kysely_deno_postgres/mod.ts';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

Sentry.setTag('region', Deno.env.get('SB_REGION'));
Sentry.setTag('execution_id', Deno.env.get('SB_EXECUTION_ID'));

console.log('Hello from create analytics data');

const dbUrl = Deno.env.get('DATABASE_URL');
const sslCert = Deno.env.get('DATABASE_SSL_CERT');
if (!dbUrl || !sslCert) {
  console.error('DATABASE_URL or DATABASE_SSL_CERT is not set');
  Deno.exit(1);
}

Deno.serve(async (req) => {
  return Sentry.withScope(async (scope) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    let fid;
    try {
      const body = await req.json();
      fid = body.fid;
      if (!fid) {
        throw new Error('FID is required');
      }
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    try {
      const sslCertFormatted = sslCert.replace(/\\n/g, '\n');
      const parsedUrl = new URL(dbUrl);
      const driver = new PostgreSQLDriver({
        connection: {
          attempts: 1,
        },
        hostname: parsedUrl.hostname,
        port: parseInt(parsedUrl.port),
        database: parsedUrl.pathname.slice(1),
        user: parsedUrl.username,
        password: parsedUrl.password,
        host_type: 'tcp',
        tls: {
          enabled: true,
          enforce: true,
          caCertificates: [sslCertFormatted],
        },
      });

      const db = new Kysely({
        dialect: {
          createAdapter() {
            return new PostgresAdapter();
          },
          createDriver() {
            return driver;
          },
          createIntrospector(db: Kysely<unknown>) {
            return new PostgresIntrospector(db);
          },
          createQueryCompiler() {
            return new PostgresQueryCompiler();
          },
        },
        log(event) {
          if (event.level !== 'query') {
            console.log('KYSELY:', event);
          }
        },
      });

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { error: insertError } = await supabaseClient.from('analytics').upsert(
        {
          fid,
          status: 'pending',
        },
        { onConflict: 'fid' }
      );
      if (insertError) throw insertError;

      const linksQuery = buildAnalyticsQuery('links', fid.toString(), 'target_fid');
      const links = (await linksQuery.execute(db)).rows?.[0];
      const reactionsQuery = buildAnalyticsQuery('reactions', fid.toString(), 'target_cast_fid');
      const reactions = (await reactionsQuery.execute(db)).rows?.[0];
      const castsQuery = buildAnalyticsQuery('casts', fid.toString(), 'fid', [
        'parent_cast_hash is not NULL AS is_reply',
      ]);
      const casts = (await castsQuery.execute(db)).rows?.[0];
      const topCastsQuery = getTopCasts(fid);
      const topCasts = (await topCastsQuery.execute(db))?.rows;

      const unfollowsQuery = getRecentUnfollows(fid);
      const unfollows = (await unfollowsQuery.execute(db))?.rows;

      const res = {
        follows: formatResponseSection(links),
        reactions: formatResponseSection(reactions),
        casts: formatResponseSection(casts),
        topCasts: topCasts,
        unfollows: unfollows,
      };

      const { error: upsertError } = await supabaseClient.from('analytics').upsert(
        {
          fid,
          data: res,
          status: 'done',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fid' }
      );

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ fid, message: 'success' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: JSON.stringify(error?.message || error) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
});
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-analytics-data' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions", "fid": "3"}'

*/
