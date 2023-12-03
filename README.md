# herocast 
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)

## 🏗️ Dev Setup

- register with Supabase and create a new project https://supabase.com
- get a Neynar API key https://docs.neynar.com/docs
- get an Alchemy API key https://www.alchemy.com
- get your Farcaster account FID and mnemoic

## Local setup

- Install Supabase CLI `https://github.com/supabase/cli`
  - e.g. for MacOS with `brew install supabase/tap/supabase` 

### install dependencies

```bash
yarn install
```

### run as website

```bash
yarn dev
```

### run as native app

...coming back soon via [tauri](https://tauri.app/)...


### DB scheme: accounts
reminder: key is an edcsa key not a 'normal' EVM address
