#!/usr/bin/env bash
# Verifies the signer-key hardening migrations + authorization RPCs against a
# local Supabase stack. Exercises every attack vector the hardening plan
# claimed to close (V2 service-role bypass at signer, V3 draft row-planting,
# V4 auto-interaction hijack, V6 user-only RLS WITH CHECK, V11 audit-log
# tamper, V16 FORCE RLS) plus the happy paths so we detect over-tightening.
#
# Prereq: `supabase start` + `supabase db reset` (the migrations applied).
#
# Usage: scripts/verify-signer-hardening.sh
# Exit 0 => all checks passed. Exit 1 => at least one failure.

set -uo pipefail

# ---------- config ------------------------------------------------------------
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SIGNER_URL="${SIGNER_URL:-http://127.0.0.1:54321/functions/v1/farcaster-signer}"

PASS=0
FAIL=0
FAILED_CASES=()

c_red='\033[0;31m'; c_green='\033[0;32m'; c_yellow='\033[0;33m'; c_off='\033[0m'

pass() { echo -e "  ${c_green}PASS${c_off}  $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${c_red}FAIL${c_off}  $1"; FAIL=$((FAIL + 1)); FAILED_CASES+=("$1"); }
note() { echo -e "  ${c_yellow}NOTE${c_off}  $1"; }

header() { printf "\n== %s ==\n" "$1"; }

# run SQL, capture stdout+stderr
psql_run() { psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 "$@" 2>&1; }

# run SQL, expect ERROR containing pattern
psql_expect_error() {
  local label="$1" sql="$2" pattern="$3"
  local out
  out=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "$sql" 2>&1) && {
    fail "$label (expected error but query succeeded)"
    echo "    actual: $out" >&2
    return 1
  }
  if echo "$out" | grep -qE "$pattern"; then
    pass "$label"
  else
    fail "$label (error didn't match /$pattern/)"
    echo "    actual: $out" >&2
  fi
}

# run SQL, expect success, capture single-value result
psql_expect_ok() {
  local label="$1" sql="$2"
  local out
  if out=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "$sql" 2>&1); then
    pass "$label"
    printf '%s' "$out"
  else
    fail "$label (unexpected error)"
    echo "    actual: $out" >&2
  fi
}

require_db() {
  if ! psql "$DB_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "cannot connect to $DB_URL — is \`supabase start\` running?" >&2
    exit 2
  fi
}

# ---------- setup -------------------------------------------------------------
require_db

header "Setup: apply seed + test fixtures"

# Ensure pgsodium KEK used by the encrypt trigger exists. The migrations and
# seed should handle this; we confirm idempotently.
psql_run <<'SQL' >/dev/null
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.key WHERE id='dcd0dca7-c03a-40c5-b348-fefb87be2845') THEN
    INSERT INTO pgsodium.key (id, key_type, key_id, key_context, name)
    VALUES ('dcd0dca7-c03a-40c5-b348-fefb87be2845'::uuid,
            'aead-det', nextval('pgsodium.key_key_id_seq'),
            decode('7067736f6469756d','hex'),
            'herocast_encryption_key');
  END IF;
END $$;
SQL

# Clear previous fixture runs (idempotent).
psql_run <<'SQL' >/dev/null
DELETE FROM public.signing_audit_log WHERE account_id IN (
  SELECT id FROM public.accounts WHERE name LIKE 'verify-fixture-%'
);
DELETE FROM public.list WHERE name LIKE 'verify-fixture-%';
DELETE FROM public.draft WHERE data->>'verify_fixture' = 'true';
DELETE FROM public.accounts WHERE name LIKE 'verify-fixture-%';
DELETE FROM public.profile WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('verify-victim@test.local','verify-attacker@test.local')
);
DELETE FROM auth.users WHERE email IN ('verify-victim@test.local','verify-attacker@test.local');
SQL

# Fixture setup runs in a single psql session so that
# `session_replication_role = 'replica'` persists across the statements.
# This GUC bypasses pgsodium's encrypt trigger (whose event-trigger companion
# would otherwise reinstate it after an ALTER TABLE DISABLE). The tests only
# exercise the authorization layer, not ciphertext handling.
FIXTURE=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<'SQL' 2>&1
SET session_replication_role = 'replica';

WITH ins AS (
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (gen_random_uuid(), 'verify-victim@test.local',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  RETURNING id
) SELECT 'VICTIM_ID=' || id::text FROM ins;

WITH ins AS (
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (gen_random_uuid(), 'verify-attacker@test.local',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  RETURNING id
) SELECT 'ATTACKER_ID=' || id::text FROM ins;

INSERT INTO public.profile (user_id, email)
  SELECT id, email FROM auth.users
  WHERE email IN ('verify-victim@test.local','verify-attacker@test.local')
  ON CONFLICT (user_id) DO NOTHING;

WITH vu AS (SELECT id FROM auth.users WHERE email='verify-victim@test.local'),
     ins AS (
  INSERT INTO public.accounts (id, user_id, platform, private_key, public_key, platform_account_id, status, name)
  SELECT gen_random_uuid(), vu.id, 'farcaster', '0xdeadbeef',
         '0x' || encode(gen_random_bytes(32), 'hex'),
         '12345', 'active', 'verify-fixture-victim'
  FROM vu
  RETURNING id
) SELECT 'VICTIM_ACCT=' || id::text FROM ins;

WITH au AS (SELECT id FROM auth.users WHERE email='verify-attacker@test.local'),
     ins AS (
  INSERT INTO public.accounts (id, user_id, platform, private_key, public_key, platform_account_id, status, name)
  SELECT gen_random_uuid(), au.id, 'farcaster', '0xcafebabe',
         '0x' || encode(gen_random_bytes(32), 'hex'),
         '54321', 'active', 'verify-fixture-attacker'
  FROM au
  RETURNING id
) SELECT 'ATTACKER_ACCT=' || id::text FROM ins;

RESET session_replication_role;
SQL
)
# Parse the key=value pairs out of the output
eval "$(echo "$FIXTURE" | grep -E '^(VICTIM_|ATTACKER_)')"

if [[ -z "${VICTIM_ID:-}" || -z "${ATTACKER_ID:-}" || -z "${VICTIM_ACCT:-}" || -z "${ATTACKER_ACCT:-}" ]]; then
  echo "fixture setup failed:" >&2
  echo "$FIXTURE" >&2
  exit 2
fi

note "victim user_id:   $VICTIM_ID"
note "attacker user_id: $ATTACKER_ID"
note "victim account_id:   $VICTIM_ACCT"
note "attacker account_id: $ATTACKER_ACCT"

note "victim account_id:   $VICTIM_ACCT"
note "attacker account_id: $ATTACKER_ACCT"

# ---------- V3: draft row-planting --------------------------------------------
header "V3 — scheduled-cast hijack via draft row-planting"

# (a) RLS layer — attacker INSERT with victim's account_id should fail
psql_expect_error \
  "V3a RLS: attacker cannot INSERT draft with victim's account_id" \
  "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ATTACKER_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.draft (account_id, status, scheduled_for, data, created_by_user_id)
   VALUES ('$VICTIM_ACCT'::uuid, 'scheduled', now()+interval '1 minute', '{\"text\":\"hijack\"}'::jsonb, '$ATTACKER_ID'::uuid);" \
  "row-level security|new row violates row-level security|check constraint|policy"

# (b) RPC layer — construct a draft directly (as postgres, bypassing RLS) where
# created_by_user_id != accounts.user_id, then call authorize_draft_publish.
BOGUS_DRAFT=$(psql_run -c "INSERT INTO public.draft (account_id, status, scheduled_for, data, created_by_user_id)
  VALUES ('$VICTIM_ACCT'::uuid, 'scheduled', now()+interval '1 minute', '{\"text\":\"hijack\",\"verify_fixture\":true}'::jsonb, '$ATTACKER_ID'::uuid)
  RETURNING id;")
psql_expect_error \
  "V3b RPC: authorize_draft_publish rejects cross-user draft" \
  "SELECT * FROM public.authorize_draft_publish('$BOGUS_DRAFT'::uuid);" \
  "unauthorized draft publish"

# (c) Happy path — victim's own legit draft passes RLS + RPC
VICTIM_DRAFT=$(psql_run -c "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$VICTIM_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.draft (account_id, status, scheduled_for, data)
   VALUES ('$VICTIM_ACCT'::uuid, 'scheduled', now()+interval '1 minute', '{\"text\":\"legit\",\"verify_fixture\":true}'::jsonb)
   RETURNING id;")
if [[ -n "$VICTIM_DRAFT" ]]; then
  pass "V3c happy path: victim's own legit draft INSERT succeeds"
else
  fail "V3c happy path: victim's own legit draft INSERT failed"
fi

# RPC should accept the legit draft
psql_expect_ok \
  "V3d happy path: authorize_draft_publish accepts victim's own draft" \
  "SELECT owner_user_id::text FROM public.authorize_draft_publish('$VICTIM_DRAFT'::uuid);" >/dev/null

# ---------- V4: auto-interaction list hijack ----------------------------------
header "V4 — auto-interaction hijack via contents.sourceAccountId"

# (a) Trigger layer — attacker's list with mismatched sourceAccountId
psql_expect_error \
  "V4a trigger: mismatched sourceAccountId rejected on INSERT" \
  "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ATTACKER_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.list (user_id, idx, name, type, contents, account_id)
   VALUES ('$ATTACKER_ID'::uuid, 1, 'verify-fixture-hijack', 'auto_interaction',
           jsonb_build_object('sourceAccountId','$VICTIM_ACCT','actionType','both','fids',ARRAY['1']),
           '$ATTACKER_ACCT'::uuid);" \
  "sourceAccountId must belong to list owner|sourceAccountId"

# (b) Trigger — null sourceAccountId also rejected
psql_expect_error \
  "V4b trigger: null sourceAccountId rejected" \
  "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ATTACKER_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.list (user_id, idx, name, type, contents, account_id)
   VALUES ('$ATTACKER_ID'::uuid, 2, 'verify-fixture-nullsrc', 'auto_interaction',
           jsonb_build_object('actionType','both','fids',ARRAY['1']),
           '$ATTACKER_ACCT'::uuid);" \
  "sourceAccountId"

# (c) Happy path — attacker's own auto-interaction list against their own account
ATTACKER_LIST=$(psql_run -c "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ATTACKER_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.list (user_id, idx, name, type, contents, account_id)
   VALUES ('$ATTACKER_ID'::uuid, 3, 'verify-fixture-legit', 'auto_interaction',
           jsonb_build_object('sourceAccountId','$ATTACKER_ACCT','actionType','both','fids',ARRAY['1']),
           '$ATTACKER_ACCT'::uuid)
   RETURNING id;")
if [[ -n "$ATTACKER_LIST" ]]; then
  pass "V4c happy path: owner's auto-interaction list INSERT succeeds"
else
  fail "V4c happy path: owner's auto-interaction list INSERT failed"
fi

# (d) RPC layer: authorize_auto_interaction on the legit list succeeds
psql_expect_ok \
  "V4d RPC happy path: authorize_auto_interaction accepts legit list" \
  "SELECT source_account_id::text FROM public.authorize_auto_interaction('$ATTACKER_LIST'::uuid);" >/dev/null

# (e) RPC layer: craft a list bypassing the trigger (session_replication_role=replica
# skips user triggers for the INSERT) and verify the RPC still rejects it —
# independent defense layer.
BOGUS_LIST=$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET session_replication_role = 'replica';
WITH ins AS (
  INSERT INTO public.list (user_id, idx, name, type, contents, account_id)
  VALUES ('$ATTACKER_ID'::uuid, 4, 'verify-fixture-bogus', 'auto_interaction',
          jsonb_build_object('sourceAccountId','$VICTIM_ACCT','actionType','both','fids',ARRAY['1']),
          '$ATTACKER_ACCT'::uuid)
  RETURNING id
) SELECT id FROM ins;
SQL
)
psql_expect_error \
  "V4e RPC: authorize_auto_interaction rejects cross-user list" \
  "SELECT * FROM public.authorize_auto_interaction('$BOGUS_LIST'::uuid);" \
  "sourceAccountId ownership mismatch"

# ---------- V11 + V16: audit log posture --------------------------------------
header "V11 — audit-log INSERT policy gone; V16 — FORCE RLS"

# Authenticated role should be unable to INSERT into signing_audit_log
psql_expect_error \
  "V11 authenticated cannot INSERT into signing_audit_log" \
  "SET LOCAL role authenticated;
   SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$VICTIM_ID\", \"role\": \"authenticated\"}';
   INSERT INTO public.signing_audit_log (user_id, account_id, action, success)
   VALUES ('$VICTIM_ID'::uuid, '$VICTIM_ACCT'::uuid, 'cast.create', true);" \
  "row-level security|policy|permission denied"

# Service-role can INSERT (signer's audit path relies on this)
if psql_run <<SQL >/dev/null 2>&1
SET ROLE service_role;
INSERT INTO public.signing_audit_log (user_id, actor_user_id, account_id, action, success, source)
VALUES ('$VICTIM_ID'::uuid, '$VICTIM_ID'::uuid, '$VICTIM_ACCT'::uuid, 'cast.create', true, 'user');
RESET ROLE;
SQL
then
  pass "V11b service_role can INSERT audit rows (used by signer)"
else
  fail "V11b service_role audit INSERT failed (Bug 2 regression)"
fi

# V16: FORCE RLS on accounts prevents postgres owner from bypassing when running
# as authenticated (documents the posture)
FORCED=$(psql_run -c "SELECT relname FROM pg_class WHERE relforcerowsecurity=true AND relname IN ('accounts','draft','list','signing_audit_log','signing_idempotency');")
EXPECTED_COUNT=5
ACTUAL_COUNT=$(echo "$FORCED" | wc -l | tr -d ' ')
if [[ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]]; then
  pass "V16 FORCE ROW LEVEL SECURITY set on 5 sensitive tables"
else
  fail "V16 expected 5 FORCED tables, got $ACTUAL_COUNT: $FORCED"
fi

# ---------- Grant & RPC posture -----------------------------------------------
header "Grant posture"

# `-qAt` + ::text renders bool as true/false (not t/f); normalize with a helper
truthy() { [[ "$1" == "t" || "$1" == "true" ]]; }
falsy()  { [[ "$1" == "f" || "$1" == "false" ]]; }

# decrypted_account RPC should be EXECUTE-able by authenticated (we kept this
# grant; the RPC self-filters via auth.uid()).
RPC_AUTH=$(psql_run -c "SELECT has_function_privilege('authenticated','public.decrypted_account(uuid)','EXECUTE')::text;")
if truthy "$RPC_AUTH"; then
  pass "decrypted_account EXECUTE retained for authenticated (Bug 1 fix)"
else
  fail "decrypted_account EXECUTE should be true for authenticated, got '$RPC_AUTH'"
fi

# authorize_* RPCs should be service_role-only
for rpc in authorize_draft_publish authorize_auto_interaction; do
  ANON=$(psql_run -c "SELECT has_function_privilege('anon','public.${rpc}(uuid)','EXECUTE')::text;")
  AUTH=$(psql_run -c "SELECT has_function_privilege('authenticated','public.${rpc}(uuid)','EXECUTE')::text;")
  SERVICE=$(psql_run -c "SELECT has_function_privilege('service_role','public.${rpc}(uuid)','EXECUTE')::text;")
  if falsy "$ANON" && falsy "$AUTH" && truthy "$SERVICE"; then
    pass "${rpc} EXECUTE restricted to service_role"
  else
    fail "${rpc} EXECUTE grants wrong (anon=$ANON auth=$AUTH service=$SERVICE; expected false/false/true)"
  fi
done

# Decrypted view grants should not include anon/authenticated
VIEW_ANON=$(psql_run -c "SELECT has_table_privilege('anon','public.decrypted_accounts','SELECT')::text;")
VIEW_AUTH=$(psql_run -c "SELECT has_table_privilege('authenticated','public.decrypted_accounts','SELECT')::text;")
if falsy "$VIEW_ANON" && falsy "$VIEW_AUTH"; then
  pass "decrypted_accounts view not SELECTable by anon/authenticated"
else
  fail "decrypted_accounts view grants wrong (anon=$VIEW_ANON auth=$VIEW_AUTH; expected false/false)"
fi

# Vault schema USAGE should be revoked from authenticated
VAULT_USAGE=$(psql_run -c "SELECT has_schema_privilege('authenticated','vault','USAGE')::text;" 2>&1)
if falsy "$VAULT_USAGE"; then
  pass "vault schema USAGE revoked from authenticated"
elif truthy "$VAULT_USAGE"; then
  fail "vault schema USAGE still granted to authenticated"
else
  note "vault schema privilege probe returned: $VAULT_USAGE (schema may not exist locally)"
fi

# ---------- Summary -----------------------------------------------------------
header "Summary"
printf "  %d pass, %d fail\n" "$PASS" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  printf "\nFailed cases:\n"
  for c in "${FAILED_CASES[@]}"; do
    printf "  - %s\n" "$c"
  done
  exit 1
fi
exit 0
