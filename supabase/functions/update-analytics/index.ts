/*
  # update-analytics function

  This function is responsible for updating all analytics data in the analytics table.
  It fetches all existing entries in the analytics table and 
  iterates over each fid to call the create-analytics-data function.

  Runs daily to ensure all analytics data is up-to-date at least every 24hrs.

  Simple logic because it refreshes all analytics data, independent if it has been viewed recently or not.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

console.log("Hello from update-analytics!");

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all existing entries in the analytics table
    const { data: analyticsData, error: fetchError } = await supabaseClient.from("analytics").select("fid");

    if (fetchError) throw fetchError;

    // Iterate over each fid and call the create-analytics-data function
    for (const entry of analyticsData) {
      const fid = entry.fid;
      const response = await supabaseClient.functions.invoke("create-analytics-data", {
        body: JSON.stringify({ fid }),
      });

      if (response.error) {
        console.error(`Failed to update analytics for fid: ${fid}`, response.error);
      } else {
        console.log(`Successfully updated analytics for fid: ${fid}`);
      }
    }

    return new Response(JSON.stringify({ message: "All analytics data updated successfully" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/update-analytics' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{}'

*/
