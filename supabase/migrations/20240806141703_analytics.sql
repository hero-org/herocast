-- Create the analytics table
CREATE TABLE IF NOT EXISTS "public"."analytics" (
    fid BIGINT NOT NULL,
    data JSONB,
    status TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT analytics_pkey PRIMARY KEY (fid)
);

-- Enable Row Level Security
ALTER TABLE
    "public"."analytics" ENABLE ROW LEVEL SECURITY;

-- Grant necessary privileges
GRANT
SELECT
    ON "public"."analytics" TO authenticated;

GRANT
SELECT
    ON "public"."analytics" TO anon;

alter policy "Enable read access for all users" on "public"."analytics" to public using (true);

-- Create a function to update the updated_at column
CREATE
OR REPLACE FUNCTION update_modified_column() RETURNS TRIGGER AS $ $ BEGIN NEW.updated_at = now();

RETURN NEW;

END;

$ $ language 'plpgsql';

-- Create a trigger to call the function
CREATE TRIGGER update_analytics_modtime BEFORE
UPDATE
    ON "public"."analytics" FOR EACH ROW EXECUTE FUNCTION update_modified_column();