ALTER TABLE
    "public"."channel"
ADD
    COLUMN IF NOT EXISTS description text,
ADD
    COLUMN IF NOT EXISTS data jsonb;