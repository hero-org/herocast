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
- Install pnpm (if not already installed for this Node version):
  ```bash
  npm -g install pnpm
  ```
- Install packages:
  ```bash
  pnpm install
  ```

4. Create a file `.env.local`:

- For macOS or Linux:
  ```bash
  cp .env.example .env.local
  ```
- For Windows:
  ```bash
  xcopy .env.example .env.local
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
- Copy the API Key to your `.env.local`.
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

#### Docker

- If you don't have Docker installed, you can download it from [here](https://docs.docker.com/get-docker/).
- Once installed, make sure Docker daemon is running. You can test it by running `docker ps` in your terminal. If it fails, you will need to start the Docker daemon.

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
  NEXT_PUBLIC_SUPABASE_URL = '<API URL>'
  NEXT_PUBLIC_SUPABASE_ANON_KEY = '<anon key>'
  ```

6. Set up accounts table signer encryption in your SQL Editor:

- Open the Studio URL in the browser and navigate to the SQL Editor tab
- Generate a private encryption key:
  ```sql
  SELECT * FROM pgsodium.create_key();
  ```
- Get the key ID (copy the id obtained, as it is needed in the next command):
  ```sql
  SELECT id FROM pgsodium.valid_key LIMIT 1;
  ```
- Run the following command (replace <PG_SODIUM_KEY> with the id from the previous command):
  ```sql
  SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."accounts"."private_key" IS 'ENCRYPT WITH KEY ID <PG_SODIUM_KEY> SECURITY INVOKER';
  ```
  You should get the response "Success. No rows returned" indicating that the command was successful and returned no rows.

7. Run the local app in development mode:

```bash
pnpm dev
```

This will output:

```bash
$ next dev
  - Local:        http://localhost:3000
  - Environments: .env.local, .env.development
...
✓ Ready in 2.4s
```

Click the localhost link to open the app in your browser. If the compilation fails due to missing .env variables, double-check the spelling of the variable names.

Congratulations! You now have a local version of herocast working.

### Working with supabase migrations

1. Create a new migration:

```bash
supabase migration new <migration-name>
```

2. Edit the migration file in the `migrations` folder.
3. Run the migration:

```bash
supabase migration up --local
```

More info in the supabase docs:
https://supabase.com/docs/reference/cli/supabase-migration

### Working with supabase functions

1. Create a new function:

```bash
supabase functions new <Function name>
```

2. Edit the function file in the `functions` folder.
3. Serve the function locally:

```
supabase functions serve
```

4. Call the function locally via curl (see bottom of the function file for curl CLI command)

More info in the supabase docs:
https://supabase.com/docs/reference/cli/supabase-functions

### Working with supabase migrations

1. Create a new migration file with: `supabase migration new <migration_name>`
2. Fill in the created sql file with your migration logic
3. Apply the migration locally with `supabase migration up --local`
4. Get the updated database types for the supabase typescript client (make sure to not remove the custom types at the bottom):
   `supabase gen types --local --lang typescript -s public > src/common/types/database.types.ts`

More info in the supabase docs:
https://supabase.com/docs/reference/cli/supabase-migration

### Working with supabase functions

1. Create a new function:

```bash
supabase functions new <Function name>
```

2. Edit the function file in the `functions` folder.
3. Serve the function locally:

```
supabase functions serve
```

4. Call the function locally via curl (see bottom of the function file for curl CLI command)

More info in the supabase docs:
https://supabase.com/docs/reference/cli/supabase-functions

### Working with supabase migrations

1. Create a new migration file with: `supabase migration new <migration_name>`
2. Fill in the created sql file with your migration logic
3. Apply the migration locally with `supabase migration up --local`
4. Get the updated database types for the supabase typescript client (make sure to not remove the custom types at the bottom):
   `supabase gen types --local --lang typescript -s public > src/common/types/database.types.ts`

### Run as a Native App

...coming back soon via [tauri](https://tauri.app/)...

### DB Scheme: Accounts

Reminder: The key is an edcsa key, not a 'normal' EVM address.

### Testing Transactions

Running transaction testing on a test network is critical for making sure transactions work as intended before they are used on live servers.

## Contact Information

If you have any questions or need assistance with contributing to herocast, please feel free to reach out to the project maintainers. Contact information can be found in the [README](./README.md#contact) file.

Thank you for your contributions!
