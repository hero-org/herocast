-- Spike 3 — Hub provider selection: tag each audit row with the Hub provider
-- the message was submitted to. Distinct from the existing `source` column
-- which encodes request origin (user vs cron).

ALTER TABLE public.signing_audit_log
  ADD COLUMN IF NOT EXISTS provider TEXT
    CHECK (provider IN ('neynar','hypersnap'))
    DEFAULT 'neynar';

COMMENT ON COLUMN public.signing_audit_log.provider IS
  'Hub provider the message was submitted to. Distinct from source (request origin).';
