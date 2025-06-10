-- Add column to store pre-encoded message bytes for reliable publishing
ALTER TABLE draft ADD COLUMN encoded_message_bytes INTEGER[];

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN draft.encoded_message_bytes IS 'Pre-encoded Farcaster message bytes using client-side hub-web libraries for reliable publishing';