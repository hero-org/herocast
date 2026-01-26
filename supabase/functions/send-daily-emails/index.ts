// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import 'https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts';

import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { createClient, FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

Sentry.setTag('region', Deno.env.get('SB_REGION'));
Sentry.setTag('execution_id', Deno.env.get('SB_EXECUTION_ID'));

console.log('Hello from sending daily emails!');

Deno.serve(async (req) => {
  return Sentry.withScope(async (scope) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get all userIds and process them
      const { data: profiles, error: userIdsError } = await supabaseClient
        .from('profile')
        .select('user_id,lists:list!inner(*)')
        .not('email', 'is', null)
        .eq('list.contents->enabled_daily_email', true);

      if (userIdsError) {
        throw new Error(`Error fetching user IDs: ${userIdsError.message}`);
      }
      const userIds = profiles.map((profile) => profile.user_id);
      console.log(`Processing ${userIds.length} users`);
      for (const userId of userIds) {
        const { data: invokeData, error: invokeError } = await supabaseClient.functions.invoke('send-digest-to-user', {
          body: { user_id: userId },
        });

        if (invokeError instanceof FunctionsHttpError) {
          const errorMessage = await invokeError.context.json();
          console.log('Function returned an error', errorMessage);
        } else if (invokeError instanceof FunctionsRelayError) {
          console.log('Relay error:', invokeError.message);
        } else if (invokeError instanceof FunctionsFetchError) {
          console.log('Fetch error:', invokeError.message);
        }
        if (invokeError) {
          Sentry.captureException(new Error(JSON.stringify(invokeError)));
          console.log(`Processed user ${userId}: error: ${JSON.stringify(invokeError)}`);
        } else {
          console.log(`Processed user ${userId}: response: ${JSON.stringify(invokeData)}`);
        }
      }

      const message = `Processed ${userIds.length} users`;
      return new Response(JSON.stringify({ message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      Sentry.captureException(error);
      return new Response(JSON.stringify({ error: error?.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  });
});

/*
To invoke:
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-daily-emails' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{"name":"Functions"}'

  */
