-- Enforce the 100-FID cap on `fids` lists at the database, so EVERY write path
-- (client store, MCP tools, direct SQL) is bounded — not just the list editor UI.
-- Hypersnap's filter feed accepts at most 100 FIDs, so a larger list would
-- silently drop the overflow. Only `type = 'fids'` lists are constrained;
-- `search` and `auto_interaction` lists are untouched (they keep their own limits).
-- Mirrors MAX_FID_LIST_SIZE (= 100) in the app + MCP constants.
--
-- NOT VALID: creating the constraint does NOT scan/reject pre-existing rows, so a
-- legacy >100 list (if any exists) is left as-is rather than failing the migration.
-- The check is still enforced on every INSERT and UPDATE going forward. The
-- expression never errors: the CASE guarantees jsonb_array_length is only called
-- when contents->'fids' is actually a JSON array (CASE short-circuits, unlike OR
-- which Postgres may evaluate in any order), and a missing/non-array fids value is
-- treated as satisfied so malformed legacy rows are never falsely rejected.
ALTER TABLE public.list
  ADD CONSTRAINT list_fids_max_100
  CHECK (
    type <> 'fids'
    OR CASE
         WHEN jsonb_typeof(contents -> 'fids') = 'array'
           THEN jsonb_array_length(contents -> 'fids') <= 100
         ELSE true
       END
  )
  NOT VALID;
