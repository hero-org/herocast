// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { runFarcasterCastSearch } from '../_shared/search.ts'

console.log("Hello from sending daily emails!")

const sendEmail = async (fromAddress: string, toAddress: string, subject: string, username: string, casts: any[]): Promise<Response> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Feed</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                padding: 20px;
                display: flex;
                justify-content: center;
            }
            .container {
                max-width: 600px;
                width: 100%;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .cast {
                background-color: white;
                border: 1px solid #ddd;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .cast-header {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }
            .cast-header img {
                border-radius: 50%;
                width: 40px;
                height: 40px;
                margin-right: 10px;
            }
            .cast-username {
                font-weight: bold;
            }
            .cast-content {
                margin-left: 50px; /* Ensure this matches or exceeds img width + margin-right */
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Hello ${username},</h1>
                <p>Here are your latest casts:</p>
            </div>
            ${casts.map(cast => `
            <div class="cast">
                <div class="cast-header">
                    <span class="cast-username">${cast.fid}</span>
                </div>
                <div class="cast-content">
                    <p>${cast.text}</p>
                </div>
            </div>
            `).join('')}
        </div>
    </body>
    </html>
  `;

  const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
      },
      body: JSON.stringify({
          from: fromAddress,
          to: toAddress,
          subject: subject,
          html: htmlContent,
      })
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
          'Content-Type': 'application/json',
      },
  });
};

serve(async (req) => {

  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: entries } = await supabaseClient
    .from('list')
    .select('*')
    .contains('contents', { enabled_daily_email: true });

    entries.forEach(async (entry) => {

      const casts = runFarcasterCastSearch({
        searchTerm: entry.term,
        filters: entry.filters,
        limit: 5,
      })
      
      const { data: userArray } = await supabaseClient
        .from('accounts')
        .select('*')
        .eq('user_id', entry.account_id)
        .limit(1);
      
      const username = userArray[0].name;

      sendEmail(FROM_ADDRESS, TO_ADDRESS, 'Your Daily Casts', username, casts);
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})