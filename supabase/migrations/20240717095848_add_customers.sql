CREATE TABLE IF NOT EXISTS "public"."customers" (
  id UUID DEFAULT "gen_random_uuid"() NOT NULL,
  -- user_id UUID from auth.users
  user_id uuid references auth.users not null primary key,
  -- The user's customer ID in Stripe. User must not be able to update this.
  stripe_customer_id text,
  -- The user's hypersub subscription ID. User must not be able to update this.
  hypersub_token_id text
);
alter table customers enable row level security;
