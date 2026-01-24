#!/bin/bash

# Configure Claude Code to use the local MCP server.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../../.."

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude CLI not found. Install Claude Code first."
  exit 1
fi

if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  echo "Error: Supabase is not running. Start it with: supabase start"
  exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  STATUS_JSON=$(supabase status --output json 2>/dev/null || true)
  if [ -n "$STATUS_JSON" ]; then
    if command -v jq >/dev/null 2>&1; then
      SUPABASE_ANON_KEY=$(echo "$STATUS_JSON" | jq -r '.ANON_KEY // .anon_key // .api.anon_key')
    elif command -v node >/dev/null 2>&1; then
      SUPABASE_ANON_KEY=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));console.log(data.ANON_KEY || data.anon_key || (data.api && data.api.anon_key) || '');" <<< "$STATUS_JSON")
    fi
  fi
fi

if [ -z "$SUPABASE_ANON_KEY" ] || [ "$SUPABASE_ANON_KEY" = "null" ]; then
  echo "Error: SUPABASE_ANON_KEY not set. Run: supabase status --output json"
  exit 1
fi

export SUPABASE_URL="http://localhost:54321"
export SUPABASE_ANON_KEY

if [ "$SKIP_TEST_SEED" != "true" ]; then
  echo "Seeding test users/accounts..."
  deno run \
    --config "$PROJECT_ROOT/supabase/functions/farcaster-signer/deno.json" \
    --allow-net \
    --allow-env \
    --allow-read \
    "$PROJECT_ROOT/supabase/functions/farcaster-signer/tests/seed.ts"
fi

EMAIL="${MCP_TEST_EMAIL:-test-user-1@herocast.test}"
PASSWORD="${MCP_TEST_PASSWORD:-test-password-123}"

LOGIN_RESPONSE=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if command -v jq >/dev/null 2>&1; then
  ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
else
  ACCESS_TOKEN=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));console.log(data.access_token || '');" <<< "$LOGIN_RESPONSE")
fi

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "Error: Failed to get access token."
  echo "$LOGIN_RESPONSE"
  exit 1
fi

MCP_URL="${MCP_URL:-http://localhost:54321/functions/v1/mcp-server}"
MCP_NAME="${MCP_NAME:-herocast-mcp}"

claude mcp remove --scope project "$MCP_NAME" >/dev/null 2>&1 || true
claude mcp add --scope project --transport http "$MCP_NAME" "$MCP_URL" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "apikey: $SUPABASE_ANON_KEY"

echo "Added $MCP_NAME to Claude Code (project scope)."
echo "Re-run this script to refresh the token if tools start failing."
