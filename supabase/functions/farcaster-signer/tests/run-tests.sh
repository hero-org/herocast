#!/bin/bash

# Farcaster Signing Service Test Runner
# Usage: ./run-tests.sh [--e2e]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Farcaster Signing Service Tests ===${NC}"
echo

# Check if Supabase is running
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
    echo -e "${RED}Error: Supabase is not running.${NC}"
    echo "Start it with: supabase start"
    exit 1
fi

# Get anon key if not set
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}SUPABASE_ANON_KEY not set, trying to get from supabase status...${NC}"
    STATUS_JSON=$(supabase status --output json 2>/dev/null || true)
    if [ -n "$STATUS_JSON" ]; then
        if command -v jq >/dev/null 2>&1; then
            SUPABASE_ANON_KEY=$(echo "$STATUS_JSON" | jq -r '.ANON_KEY // .anon_key // .api.anon_key')
        elif command -v node >/dev/null 2>&1; then
            SUPABASE_ANON_KEY=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));console.log(data.ANON_KEY || data.anon_key || (data.api && data.api.anon_key) || '');" <<< "$STATUS_JSON")
        fi
    fi
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        SUPABASE_ANON_KEY=$(supabase status 2>/dev/null | grep "anon key:" | awk '{print $3}')
    fi
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        echo -e "${RED}Error: Could not get anon key. Set SUPABASE_ANON_KEY manually.${NC}"
        exit 1
    fi
    export SUPABASE_ANON_KEY
    echo -e "${GREEN}Got anon key from supabase status${NC}"
fi

export SUPABASE_URL="http://localhost:54321"

# Apply pgsodium grants and seed key (skip with SKIP_PGSODIUM_SETUP=true)
if [ "$SKIP_PGSODIUM_SETUP" != "true" ]; then
    echo -e "${YELLOW}Applying pgsodium grants and key...${NC}"
    if command -v psql >/dev/null 2>&1; then
        export PGPASSWORD=postgres
        psql -h localhost -p 54322 -U postgres -d postgres -f "$SCRIPT_DIR/../../../setup/pgsodium_grants.sql"
        psql -h localhost -p 54322 -U postgres -d postgres -f "$SCRIPT_DIR/../../../setup/pgsodium_seed_key.sql"
    elif command -v node >/dev/null 2>&1; then
        node "$SCRIPT_DIR/../../../../scripts/apply-pgsodium-grants.js"
    else
        echo -e "${RED}Error: pgsodium setup skipped (no psql or node). Install one and retry.${NC}"
        exit 1
    fi
fi

# Seed test users/accounts (skip with SKIP_TEST_SEED=true)
if [ "$SKIP_TEST_SEED" != "true" ]; then
    echo -e "${YELLOW}Seeding test users/accounts...${NC}"
    deno run \
        --config "$SCRIPT_DIR/../deno.json" \
        --allow-net \
        --allow-env \
        --allow-read \
        "$SCRIPT_DIR/seed.ts"
fi

# Check for --e2e flag
if [ "$1" == "--e2e" ]; then
    echo -e "${YELLOW}Running ALL tests including E2E (requires Hub connectivity)${NC}"
    echo
else
    echo -e "${YELLOW}Running validation tests only (skipping E2E)${NC}"
    echo "Use --e2e to include Hub tests"
    echo
    export SKIP_E2E_TESTS=true
fi

# Check if function is running
echo "Checking if signing service is running..."
FUNCTION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/functions/v1/farcaster-signer/health 2>/dev/null || echo "000")

if [ "$FUNCTION_STATUS" == "000" ] || [ "$FUNCTION_STATUS" == "404" ]; then
    echo -e "${YELLOW}Warning: Signing service may not be running.${NC}"
    echo "Start it with: supabase functions serve farcaster-signer --no-verify-jwt"
    echo
fi

# Run tests
echo -e "${GREEN}Running tests...${NC}"
echo

deno test \
    --config "$SCRIPT_DIR/../deno.json" \
    --allow-net \
    --allow-env \
    --allow-read \
    ./*.test.ts

echo
echo -e "${GREEN}=== Tests Complete ===${NC}"
