-- Spike 3 — Hub provider selection: tag each audit row with the Hub provider
-- the message was submitted to. Distinct from the existing `source` column
-- which encodes request origin (user vs cron).

-- NOT NULL with DEFAULT 'neynar': PG backfills existing rows on ADD COLUMN.
-- The CHECK constraint alone would allow NULL (CHECK treats NULL as satisfied
-- in PG), so NOT NULL is required to guarantee every audit row has a provider.
ALTER TABLE public.signing_audit_log
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL
    CHECK (provider IN ('neynar','hypersnap'))
    DEFAULT 'neynar';

COMMENT ON COLUMN public.signing_audit_log.provider IS
  'Hub provider the message was submitted to. Distinct from source (request origin).';
