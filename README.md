# herocast 
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)
![herocast_cartridge_landscape](https://github.com/hellno/herocast/assets/686075/f6925730-6e41-4729-93c0-4ce617b15aee)


'Superhuman for Farcaster'
= keyboard-first. support for multiple accounts and switching channels. cmd + k (command palette) to control everything.

## What is Farcaster?
a protocol for decentralized social apps: https://www.farcaster.xyz

## 🏗️ Dev Setup

1. Clone the repo
```
git clone https://github.com/hellno/herocast.git
```
2. Install Supabase CLI
``` bash
# form linux of MacOS with HomeBrew installed
brew install supabase/tap/supabase 

# or download the .deb/.apk/.rpm from here (m)
wget https://github.com/supabase/cli/releases/download/v1.163.6/supabase_1.163.6_linux_amd64.deb
sudo dpkg -i supabase_1.163.6_linux_amd64.deb
```
3. Install dependencies
```bash
# https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
# switch to the appropriate Node version
nvm use
## or if version is not installed
nvm install

## install yarn (if not already for this node version)
npm -g install yarn

## install packages
yarn 
```
4. Create a file `.env.development.local` 
```bash
# mac or linux
cp .env.example .env.development.local

# windows
xcopy .env.example .env.development.local
```
5. Getting your ENV variables set
 
 ### Glide API Key
 Go to [Glide's website](https://paywithglide.xyz/) and sign up with your email.

 They will respond shortly with an API key (it appears to be manually done).

 They will want to know which contracts to enable for the API key, just let them know you are with `herocast` and that they should
 already be whitelisted.

 ### Neynar API KEY
 Go to [Neynar's Dev Portal](https://dev.neynar.com/) and signup for the cheapest plan.

 Once you've got access to the dashboard, the API Key is on the main page at the top "Neynar API key". 
 
 Copy to clipboard.
 ```bash
  ...
  NEXT_PUBLIC_NEYNAR_API_KEY = 'neynar-api-key-here'
  ...
 ```

 ### Alchemy API Key
 Go to [Alchemy's website and get your API Key](https://alchemy.com).
 
 1. If you have not created an account, create a new account, select the "Free" option.
 2. When selecting chains you will develop on, only Optimism is required, but you can select others if you want.
 3. Then fill out whatever you feel is neccessary, and no need to get the bonus compute units (but feel free to).
 4. When you selected your chains on account creation, Alchemy created some Apps for you.
 5. In the Sidebar menu, select "Apps" and find the "<First Name>'s Optimism App" and click the "API Key" button.
 6. Then copy the first entry, "API Key" to your `.env.development.local`
 ```bash
 ...
 NEXT_PUBLIC_ALCHEMY_API_KEY = 'alchemy-api-key-here'
 ...
```

### Get your Farcaster account information
It would be best practice to get a dev account for this purpose, before you log out, make sure you save your main account's Nmemonic phrase.

Assuming you've created your new account:
#### Nmemonic Phrase
This phrase is what they asked you to back up during your account creation process.

If you did not back it up, but you are still logged in, you can find it on your mobile app:
`Settings (gear icon)->Advanced->Recovery Phrase`

```bash
NEXT_PUBLIC_APP_MNENOMIC = 'candy maple cake sugar honey ... potato blue'
```
#### FID
This is found in your account's About information labeled as `FID`, e.g. `FID: 1234`

In the app (desktop or mobile):
`Profile->About (may be under the upper right corner elipses menu)->FID`

```bash
NEXT_PUBLIC_APP_FID = '123'
```

### Get your Supabase API information
Start your local Supabase instance:
`supabase start`

This will take a while to download all the containers and get started.  

Once done it will spit back a bunch of variables.

Find: 'API KEY' and 'anon key'.

You can view these at any time using the command: `supabase status`

Save them as:
```bash
NEXT_PUBLIC_SUPABASE_URL = '<API KEY>'
NEXT_PUBLIC_SUPABASE_ANON_KEY = '<anon key>'
```

## Run the local app in development mode
```bash
yarn dev
```

This will output: 
```bash
$ next dev
   - Local:        http://localhost:3000
   - Environments: .env.development.local, .env.development
...
 ✓ Ready in 2.4s
```

Click to open the localhost link and it should start compiling.

If the compiling fails and cannot compile because of some missing (unset) .env variables, double-check the spelling of the env variable name (copy/paste from the examples, to be sure). Be sure to check all of the ones you set yourself (it may not be the one)
its complaining about.

And congratulations, you now have a local version of herocast working!

### run as native app

...coming back soon via [tauri](https://tauri.app/)...


### DB scheme: accounts
reminder: key is an edcsa key not a 'normal' EVM address

## Testing Transactions
Running transaction testing on a test network is critical for making sure transactions work as intended before they are used on live servers.
