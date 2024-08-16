// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend";
import { SearchInterval, runFarcasterCastSearch } from "../_shared/search.ts";
import { getHtmlEmail } from "../_shared/email.ts";
import * as Sentry from "https://deno.land/x/sentry/index.mjs";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

Sentry.setTag("region", Deno.env.get("SB_REGION"));
Sentry.setTag("execution_id", Deno.env.get("SB_EXECUTION_ID"));

console.log("Hello from sending digest to user!");

type Cast = {
  hash: string;
  fid: number;
  text: string;
  timestamp: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NEYNAR_API_KEY = Deno.env.get("NEYNAR_API_KEY");

async function fetchBulkCasts(hashes: string[]): Promise<Cast[]> {
  const url = "https://api.neynar.com/v2/farcaster/casts";
  const params = new URLSearchParams({ casts: hashes.join(",") });

  try {
    const response = await fetch(`${url}?${params}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        api_key: NEYNAR_API_KEY || "",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result.casts || [];
  } catch (error) {
    console.error("Error fetching bulk casts:", error);
    return [];
  }
}

async function sendEmail(
  resend: Resend,
  fromAddress: string,
  toAddress: string,
  subject: string,
  listsWithCasts: { listName: string; searchTerm: string; casts: any[] }[]
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return false;
  }

  try {
    const html = getHtmlEmail({ listsWithCasts });
    const res = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: subject,
      html,
    });
    if (res?.error) {
      console.error("Error sending email - response has error:", res, toAddress, listsWithCasts);
    }
    return true;
  } catch (error) {
    console.error("Error sending email:", error, toAddress);
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return false;
  }
}

async function enrichCastsViaNeynar(casts: Cast[]) {
  try {
    const hashes = casts.map((cast) => cast.hash);
    return await fetchBulkCasts(hashes);
  } catch (error) {
    console.error("Error fetching casts from Neynar:", error);
    return casts;
  }
}

async function processUser(supabaseClient: any, userId: string) {
  const resend = new Resend(RESEND_API_KEY);
  const baseUrl = Deno.env.get("BASE_URL");

  const { data: profile, error: profileError } = await supabaseClient
    .from("profile")
    .select(
      `
      user_id,
      email,
      lists:list!inner(*)
    `
    )
    .eq("user_id", userId)
    .not("email", "is", null)
    .eq("list.contents->enabled_daily_email", true)
    .order("idx", { referencedTable: "list", ascending: true })
    .single();

  if (profileError) {
    throw new Error(`Error fetching profile: ${profileError.message}`);
  }

  if (!profile.email) {
    console.error(`Profile has daily digest activated but no email address set. user id ${profile.user_id}`);
    return;
  }

  if (!profile.lists || !profile.lists.length) {
    console.log(`skip user ${profile.user_id}: no lists`);
    return;
  }

  console.log(`user ${profile.user_id} has ${profile?.lists?.length} lists`);
  const listsWithCasts = await Promise.all(
    profile.lists.map(async (list) => {
      let searchResult = await runFarcasterCastSearch({
        searchTerm: list.contents.term,
        filters: { ...list.contents.filters, interval: SearchInterval.d1 },
        limit: 5,
        baseUrl,
      });
      if (searchResult.error) {
        console.error(`search error for term ${list.contents.term} for user ${profile.user_id} - skip`);
        return {
          listName: list.name,
          casts: [],
          searchTerm: list.contents.term,
        };
      } else if (searchResult.isTimeout) {
        console.log(`search timeout for term ${list.contents.term} for user ${profile.user_id} - try again`);
        searchResult = await runFarcasterCastSearch({
          searchTerm: list.contents.term,
          filters: { ...list.contents.filters, interval: SearchInterval.d1 },
          limit: 5,
          baseUrl,
        });
        console.log(`retry search result: timeout ${searchResult.isTimeout} error: ${searchResult.error}`);
      }

      const listName = list.name;
      const casts = searchResult.results || [];
      if (!casts.length) {
        return {
          listName,
          casts: [],
          searchTerm: list.contents.term,
        };
      }
      return {
        listName,
        casts: await enrichCastsViaNeynar(casts),
        searchTerm: list.contents.term,
      };
    })
  );

  const hasOnlyEmptyLists = listsWithCasts.every((list) => list.casts.length === 0);
  if (hasOnlyEmptyLists) {
    console.log(`skip user ${profile.user_id}: all lists are empty`);
    return;
  }

  const fromAddress = "hiro@herocast.xyz";
  const toAddress = profile.email;
  const didSend = await sendEmail(resend, fromAddress, toAddress, "herocast daily digest", listsWithCasts);
  return didSend;
}

Deno.serve(async (req) => {
  return Sentry.withScope(async (scope) => {
    try {
      console.log("hihi send-digest-to-user");
      const body = await req.json();
      const userId = body.user_id;

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      if (userId) {
        const didSend = await processUser(supabaseClient, userId);
        const message = didSend ? "Email sent successfully" : "No email sent";
        return new Response(JSON.stringify({ message }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // no user_id provided
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          headers: { "Content-Type": "application/json" },
          status: 400,
        });
      }
    } catch (error) {
      Sentry.captureException(error);
      return new Response(JSON.stringify({ error: error?.message }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
  });
});

/*
To invoke:
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-digest-to-user' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{"name":"Functions", "user_id": "123"}'

  */
