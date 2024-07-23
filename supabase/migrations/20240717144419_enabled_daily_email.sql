UPDATE "public"."list"
SET
    contents = jsonb_set(
        contents,
        '{enabled_daily_email}',
        'false' :: jsonb
    )
WHERE
    contents IS NOT NULL;

-- Create the profile table
CREATE TABLE public.profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE
);

-- Create a function to sync email from auth.users to public.profile
CREATE OR REPLACE FUNCTION public.sync_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profile (user_id, email)
  VALUES (NEW.id, NEW.email)
 ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to sync email when a user is created or updated in auth.users
CREATE TRIGGER sync_email_to_profile_insert_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_email_to_profile();

CREATE TRIGGER sync_email_to_profile_update_trigger
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_email_to_profile();

-- Populate the profile table with existing users who have an email
INSERT INTO public.profile (user_id, email)
SELECT id, email
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email;

-- Add foreign key constraint to list table
ALTER TABLE public.list
ADD CONSTRAINT public_list_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES profile (user_id)
ON DELETE CASCADE;
