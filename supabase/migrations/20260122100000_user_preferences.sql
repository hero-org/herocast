-- Create user_preferences table for storing user settings
CREATE TABLE user_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id)
);

-- Create index on updated_at for efficient sync queries
CREATE INDEX idx_user_preferences_updated_at ON user_preferences(updated_at);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own preferences"
    ON user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
    ON user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
    ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create trigger to auto-update updated_at on UPDATE
-- Reuse existing update_modified_column function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_modtime
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Add comment
COMMENT ON TABLE user_preferences IS 'Stores user preferences and settings for cross-device sync';
