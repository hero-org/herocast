-- Add display_order column to accounts table for custom ordering
ALTER TABLE public.accounts ADD COLUMN display_order INTEGER;

-- Create index for efficient querying
CREATE INDEX idx_accounts_user_display_order ON public.accounts(user_id, display_order);

-- Migrate existing data: assign display_order based on current created_at order
WITH ordered_accounts AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM public.accounts
  WHERE status != 'removed'
)
UPDATE public.accounts a
SET display_order = oa.rn
FROM ordered_accounts oa
WHERE a.id = oa.id;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.display_order IS 'Custom display order for accounts. Lower numbers appear first. Used for maintaining stable hotkey assignments.';