# herocast 
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)
![herocast_cartridge_landscape](https://github.com/hellno/herocast/assets/686075/f6925730-6e41-4729-93c0-4ce617b15aee)


'Superhuman for Farcaster'
= keyboard-first. support for multiple accounts and switching channels. cmd + k (command palette) to control everything.

## What is Farcaster?
a protocol for decentralized social apps: https://www.farcaster.xyz

## 🏗️ Dev Setup

1. Clone the repo
2. Install Supabase CLI: <br> e.g. for MacOS with `brew install supabase/tap/supabase`
3. Install dependencies `yarn install`
4. Create a file `.env.development.local`
5. Get the details you need for the file <br>
  a. get a Neynar API key https://docs.neynar.com/docs -> `NEXT_PUBLIC_NEYNAR_API_KEY` <br>
  b. get an Alchemy API key https://www.alchemy.com -> `NEXT_PUBLIC_ALCHEMY_API_KEY` <br>
  c. get your Farcaster account FID and mnemoic -> `NEXT_PUBLIC_APP_FID` + `NEXT_PUBLIC_APP_MNENOMIC`<br>
  d. launch local copy of Supabase with `supabase start`, use the info provided -> <br>
 `API URL`:`NEXT_PUBLIC_SUPABASE_URL` + `anon key`:`NEXT_PUBLIC_SUPABASE_ANON_KEY`

### run as native app

...coming back soon via [tauri](https://tauri.app/)...


### DB scheme: accounts
reminder: key is an edcsa key not a 'normal' EVM address

## License

Distributed under the AGPLv3 License. See LICENSE for more information.

## Contact

hellno [Warpcast](https://warpcast.com/hellno.eth)

Website: https://herocast.xyz

Github: https://github.com/hellno/herocast
