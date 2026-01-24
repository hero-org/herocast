#!/bin/bash

# MCP Server smoke test (initialize, tools/list, tools/call:list_accounts)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../../.."

echo "=== MCP Server Smoke Test ==="

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

echo "Initialize MCP session..."
INIT_RESPONSE=$(curl -sS -D - -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-smoke","version":"0.1"}}}')

SESSION_ID=$(echo "$INIT_RESPONSE" | awk -F': ' 'tolower($1)=="mcp-session-id" {print $2}' | tr -d '\r')

if [ -n "$SESSION_ID" ]; then
  echo "Session ID: $SESSION_ID"
  SESSION_HEADER=(-H "Mcp-Session-Id: $SESSION_ID")
else
  SESSION_HEADER=()
fi

echo "List tools..."
if command -v jq >/dev/null 2>&1; then
  curl -sS -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "${SESSION_HEADER[@]}" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq -r '.'
else
  curl -sS -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "${SESSION_HEADER[@]}" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
fi

echo "Call list_accounts..."
if command -v jq >/dev/null 2>&1; then
  curl -sS -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "${SESSION_HEADER[@]}" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_accounts","arguments":{}}}' | jq -r '.'
else
  curl -sS -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "${SESSION_HEADER[@]}" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_accounts","arguments":{}}}'
fi

echo "=== Smoke Test Complete ==="
