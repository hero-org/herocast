# herocast 
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)
![herocast_cartridge_landscape](https://github.com/hellno/herocast/assets/686075/f6925730-6e41-4729-93c0-4ce617b15aee)


'Superhuman for Farcaster'
= keyboard-first. support for multiple accounts and switching channels. cmd + k (command palette) to control everything.

## What is Farcaster?
a protocol for decentralized social apps: https://www.farcaster.xyz

## 🏗️ Dev Setup

- register with Supabase and create a new project https://supabase.com
- get a Neynar API key https://docs.neynar.com/docs
- get an Alchemy API key https://www.alchemy.com
- get your Farcaster account FID and mnemoic

## Local setup

  - Docs for local dev process with Supabase: https://supabase.com/docs/guides/cli/local-development#start-supabase-services
- Install Supabase CLI `https://github.com/supabase/cli`
  - e.g. for MacOS with `brew install supabase/tap/supabase` 
- run `supabase start` to get local API URL and anon key. copy those to .env file 
  - you can see the supabase dashboard locally at http://127.0.0.1:54323  
- Setup accounts table signer encryption in your SQL Editor:
  - Generate a private encryption key ```SELECT * FROM pgsodium.create_key();```
  - Get the key id ```select id from pgsodium.valid_key limit 1;```
  - Run ```SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."accounts"."private_key" IS 'ENCRYPT WITH KEY ID <PG_SODIUM_KEY> SECURITY INVOKER'```

### install dependencies

```bash
yarn install
```

### run as website

```bash
yarn dev
```

run local DB in Docker
```bash
supabase db start
```


### run as native app

...coming back soon via [tauri](https://tauri.app/)...


### DB scheme: accounts
reminder: key is an edcsa key not a 'normal' EVM address
