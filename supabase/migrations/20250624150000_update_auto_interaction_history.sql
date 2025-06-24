-- Add status and error fields to auto_interaction_history for simple error tracking
ALTER TABLE auto_interaction_history 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
ADD COLUMN IF NOT EXISTS error_message TEXT;