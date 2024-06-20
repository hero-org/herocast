# Contributing to herocast

Thank you for considering contributing to herocast. We welcome any contributions that can help improve the project, including bug reports, feature requests, and code changes.

## Getting Started

### Dev Setup

1. Clone the repo:
  ```bash
  git clone https://github.com/hellno/herocast.git
  ```

2. Install Supabase CLI:
  - For Linux or macOS with Homebrew installed:
    ```bash
    brew install supabase/tap/supabase
    ```
  - For other platforms, download the .deb/.apk/.rpm from [here](https://github.com/supabase/cli/releases) and install it.

3. Install dependencies:
  - Install NVM (Node Version Manager) by following the instructions [here](https://github.com/nvm-sh/nvm#installing-and-updating).
  - Switch to the appropriate Node version:
    ```bash
    nvm use
    ```
    If the version is not installed, use the following command to install it:
    ```bash
    nvm install
    ```
  - Install Yarn (if not already installed for this Node version):
    ```bash
    npm -g install yarn
    ```
  - Install packages:
    ```bash
    yarn
    ```

4. Create a file `.env.development.local`:
  - For macOS or Linux:
    ```bash
    cp .env.example .env.development.local
    ```
  - For Windows:
    ```bash
    xcopy .env.example .env.development.local
    ```

5. Set up your environment variables:

  #### Neynar API KEY
  - Go to [Neynar's Dev Portal](https://dev.neynar.com/) and sign up for the cheapest plan.
  - Once you have access to the dashboard, copy the API Key from the main page at the top.
    ```bash
    NEXT_PUBLIC_NEYNAR_API_KEY = 'neynar-api-key-here'
    ```

  #### Alchemy API Key
  - Go to [Alchemy's website](https://alchemy.com) and get your API Key.
  - Create a new account and select the "Free" option.
  - Select the "Optimism" chain and fill out the necessary information.
  - In the "Apps" section, find your Optimism App and click the "API Key" button.
  - Copy the API Key to your `.env.development.local`.
    ```bash
    NEXT_PUBLIC_ALCHEMY_API_KEY = 'alchemy-api-key-here'
    ```

  #### Farcaster account information
  - Get a dev account for Farcaster and save your main account's mnemonic phrase.
  - To find the mnemonic phrase, go to the mobile app: Settings (gear icon) -> Advanced -> Recovery Phrase.
    ```bash
    NEXT_PUBLIC_APP_MNEMONIC = 'candy maple cake sugar honey ... potato blue'
    ```
  - Find your FID in your account's About information. It is labeled as `FID`, e.g., `FID: 1234`.
    ```bash
    NEXT_PUBLIC_APP_FID = '123'
    ```

  #### Supabase API information
  - Start your local Supabase instance:
    ```bash
    supabase start
    ```
    This may take a while to download all the containers and get started.
  - Once it's done, find the 'API KEY' and 'anon key' by running the command:
    ```bash
    supabase status
    ```
    Save them as:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL = '<API KEY>'
    NEXT_PUBLIC_SUPABASE_ANON_KEY = '<anon key>'
    ```

6. Set up accounts table signer encryption in your SQL Editor:
  - Generate a private encryption key:
    ```sql
    SELECT * FROM pgsodium.create_key();
    ```
  - Get the key ID:
    ```sql
    SELECT id FROM pgsodium.valid_key LIMIT 1;
    ```
  - Run the following command:
    ```sql
    SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."accounts"."private_key" IS 'ENCRYPT WITH KEY ID <PG_SODIUM_KEY> SECURITY INVOKER';
    ```

7. Run the local app in development mode:
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
  Click the localhost link to open the app in your browser. If the compilation fails due to missing .env variables, double-check the spelling of the variable names.

Congratulations! You now have a local version of herocast working.

### Run as a Native App

...coming back soon via [tauri](https://tauri.app/)...

### DB Scheme: Accounts

Reminder: The key is an edcsa key, not a 'normal' EVM address.

### Testing Transactions

Running transaction testing on a test network is critical for making sure transactions work as intended before they are used on live servers.

## Contact Information

If you have any questions or need assistance with contributing to herocast, please feel free to reach out to the project maintainers. Contact information can be found in the [README](./README.md#contact) file.

Thank you for your contributions!

Thank you for considering contributing to herocast. We welcome any contributions that can help improve the project, including bug reports, feature requests, and code changes.

## Getting Started


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

- Setup accounts table signer encryption in your SQL Editor:
  - Generate a private encryption key ```SELECT * FROM pgsodium.create_key();```
  - Get the key id ```select id from pgsodium.valid_key limit 1;```
  - Run ```SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."accounts"."private_key" IS 'ENCRYPT WITH KEY ID <PG_SODIUM_KEY> SECURITY INVOKER'```


### Run the local app in development mode
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

### Testing Transactions
Running transaction testing on a test network is critical for making sure transactions work as intended before they are used on live servers.

## Contact Information

If you have any questions or need assistance with contributing to herocast, please feel free to reach out to the project maintainers. Contact information can be found in the [README](./README.md#contact) file.

Thank you for your contributions!

