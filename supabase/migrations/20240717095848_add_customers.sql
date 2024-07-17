CREATE TABLE IF NOT EXISTS "public"."customers" (
  -- UUID from auth.users
  id uuid references auth.users not null primary key,
  -- The user's customer ID in Stripe. User must not be able to update this.
  stripe_customer_id text
  -- The user's hypersub subscription ID. User must not be able to update this.
  hypersub_token_id text
);
alter table customers enable row level security;
