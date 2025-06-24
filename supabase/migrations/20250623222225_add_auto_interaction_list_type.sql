-- Add auto_interaction type to list_type enum
ALTER TYPE list_type ADD VALUE 'auto_interaction';

-- Create table to track processed auto-interactions
CREATE TABLE auto_interaction_history (
    list_id UUID REFERENCES list(id) ON DELETE CASCADE,
    cast_hash TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('like', 'recast')),
    processed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (list_id, cast_hash, action)
);

-- Enable RLS on auto_interaction_history
ALTER TABLE auto_interaction_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow access based on list ownership
CREATE POLICY "Enable access for list owners" 
    ON auto_interaction_history 
    USING (
        EXISTS (
            SELECT 1 FROM list 
            WHERE list.id = auto_interaction_history.list_id 
            AND list.user_id = auth.uid()
        )
    );

-- Create index for efficient querying
CREATE INDEX idx_auto_interaction_history_list_id ON auto_interaction_history(list_id);
CREATE INDEX idx_auto_interaction_history_processed_at ON auto_interaction_history(processed_at);