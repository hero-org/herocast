-- Create the analytics table
CREATE TABLE IF NOT EXISTS "public"."analytics" (
    fid BIGINT NOT NULL,
    data JSONB,
    CONSTRAINT analytics_pkey PRIMARY KEY (fid)
);

-- Enable Row Level Security
ALTER TABLE "public"."analytics" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows everyone to select from the table
CREATE POLICY "Allow select for everyone" ON "public"."analytics"
    FOR SELECT
    USING (true);

-- Create policies for insert, update, and delete (optional, adjust as needed)
-- For example, you might want to restrict these operations to authenticated users or specific roles
CREATE POLICY "Allow insert for authenticated users" ON "public"."analytics"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON "public"."analytics"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users" ON "public"."analytics"
    FOR DELETE
    TO authenticated
    USING (true);

-- Grant necessary privileges
GRANT ALL ON "public"."analytics" TO authenticated;
GRANT SELECT ON "public"."analytics" TO anon;
