#!/usr/bin/env node
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { Client } = require('pg');

const DEFAULT_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const connectionString = process.env.SUPABASE_LOCAL_DB_URL || process.env.SUPABASE_DB_URL || DEFAULT_DB_URL;

const sqlFiles = [
  resolve(__dirname, '../supabase/setup/pgsodium_grants.sql'),
  resolve(__dirname, '../supabase/setup/pgsodium_seed_key.sql'),
];
const statements = sqlFiles.map((sqlFile) => {
  try {
    return readFileSync(sqlFile, 'utf8');
  } catch (error) {
    console.error(`Failed to read SQL file at ${sqlFile}`);
    console.error(error);
    process.exit(1);
  }
});

(async () => {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    for (const sql of statements) {
      await client.query(sql);
    }
    console.log('pgsodium grants and key applied successfully.');
  } catch (error) {
    console.error('Failed to apply pgsodium grants.');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
})();
