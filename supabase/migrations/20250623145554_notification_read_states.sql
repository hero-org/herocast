-- Create notification_read_states table for syncing read states across devices
CREATE TABLE notification_read_states (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    notification_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    CONSTRAINT notification_read_states_pkey PRIMARY KEY (id),
    CONSTRAINT notification_read_states_unique UNIQUE (user_id, notification_id)
);

-- Create indexes for performance
CREATE INDEX idx_notification_read_states_user_id ON notification_read_states(user_id);
CREATE INDEX idx_notification_read_states_notification_id ON notification_read_states(notification_id);
CREATE INDEX idx_notification_read_states_read_at ON notification_read_states(read_at);

-- Enable Row Level Security
ALTER TABLE notification_read_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notification read states"
    ON notification_read_states
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification read states"
    ON notification_read_states
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification read states"
    ON notification_read_states
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification read states"
    ON notification_read_states
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE notification_read_states IS 'Stores notification read states for cross-device sync';