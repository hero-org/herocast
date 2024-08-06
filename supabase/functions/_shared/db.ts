import { Kysely, PostgresDialect } from 'https://esm.sh/kysely';
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

interface Database {
  casts: {
    fid: number;
    hash: string;
    timestamp: Date;
    embeds: object[];
    parent_cast_url: string | null;
    parent_cast_fid: number | null;
    parent_cast_hash: string | null;
    text: string;
    mentions: number[];
    mentions_positions: number[];
    deleted_at: Date | null;
    tsv: string;
  };
  powerbadge: {
    fid: number;
    updated_at: Date;
  };
  reactions: {
    fid: number;
    timestamp: Date;
    target_cast_fid: number;
    target_cast_hash: string;
    type: string;
  };
  analytics: {
    fid: number;
    data: any;
    updated_at: Date;
  };
}

export const getAndInitializeDataSource = async (url: string) => {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  });

  const db = new Kysely<Database>({
    dialect,
  });

  try {
    // Test the connection
    await db.selectFrom('casts').select('fid').limit(1).execute();
    console.log("Database connection has been initialized!");
    return db;
  } catch (error) {
    console.error("Error during database connection initialization:", error);
    throw error;
  }
};

export async function upsertAnalytics(db: Kysely<Database>, fid: number, data: any) {
  try {
    await db
      .insertInto('analytics')
      .values({ fid, data })
      .onConflict((oc) => oc.column('fid').doUpdateSet({ data }))
      .execute();
  } catch (error) {
    console.error('Error upserting analytics:', error);
    throw error;
  }
}

export async function getAnalytics(db: Kysely<Database>, fid: number) {
  try {
    const result = await db
      .selectFrom('analytics')
      .selectAll()
      .where('fid', '=', fid)
      .executeTakeFirst();

    return result;
  } catch (error) {
    console.error('Error getting analytics:', error);
    throw error;
  }
}
