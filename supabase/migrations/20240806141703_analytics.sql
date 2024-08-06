-- Create the analytics table
CREATE TABLE IF NOT EXISTS "public"."analytics" (
    fid BIGINT NOT NULL,
    data JSONB,
    CONSTRAINT analytics_pkey PRIMARY KEY (fid)
);

-- Enable Row Level Security
ALTER TABLE
    "public"."analytics" ENABLE ROW LEVEL SECURITY;

-- Grant necessary privileges
GRANT ALL ON "public"."analytics" TO authenticated;

GRANT
SELECT
    ON "public"."analytics" TO anon;