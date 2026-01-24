-- Signing Service Migration
-- Adds audit logging and idempotency caching for the Farcaster signing service

-- Audit log table
CREATE TABLE signing_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_account ON signing_audit_log(account_id, created_at DESC);
CREATE INDEX idx_audit_user ON signing_audit_log(user_id, created_at DESC);

ALTER TABLE signing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
  ON signing_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert audit logs only for themselves
CREATE POLICY "Users can insert own audit logs"
  ON signing_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Idempotency cache
CREATE TABLE signing_idempotency (
  idempotency_key TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  response_hash TEXT,
  response_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (idempotency_key, account_id)
);

CREATE INDEX idx_idempotency_created ON signing_idempotency(created_at);

ALTER TABLE signing_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own idempotency keys"
  ON signing_idempotency
  USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
