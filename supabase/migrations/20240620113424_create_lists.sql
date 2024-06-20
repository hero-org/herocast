-- Create the enum type for list_type
CREATE TYPE list_type AS ENUM (
    'fids',          -- List of favorite or followed fids
    'search'         -- List of saved keyword searches
);

-- Create the list table
CREATE TABLE list (
    id UUID DEFAULT "gen_random_uuid"() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type list_type NOT NULL,
    contents JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    constraint list_pkey primary key (id)
);

-- Enable row-level security
ALTER TABLE list ENABLE ROW LEVEL SECURITY;

-- Create policy to enable access for users based on user_id
CREATE POLICY "Enable access for users based on user_id" 
    ON list 
    USING (auth.uid() = user_id) 
    WITH CHECK (true);
