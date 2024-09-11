import { sql } from 'kysely';
import { NumberToBytesErrorType } from 'viem';

export function buildAnalyticsQuery(
  tableName: string,
  fid: string,
  fidFilterColumn: string,
  additionalColumns: string[] = []
) {
  const additionalColumnsSelect =
    additionalColumns.length > 0
      ? sql`, ${sql.join(
          additionalColumns.map((col) => sql.raw(col)),
          sql`, `
        )}`
      : sql``;
  const additionalColumnsGroupBy =
    additionalColumns.length > 0
      ? sql`, ${sql.join(
          additionalColumns.map((col) => sql.raw(col.split(' ').pop()!)),
          sql`, `
        )}`
      : sql``;

  console.log('buildAnalyticsQuery', fid, tableName, additionalColumns);

  return sql`
        WITH daily_counts AS (
            SELECT
                date_trunc('day', timestamp) AS day,
                COUNT(*) AS count
                ${additionalColumnsSelect}
            FROM ${sql.table(tableName)}
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            AND ${sql.ref(fidFilterColumn)} = ${fid}
            GROUP BY day${additionalColumnsGroupBy}
        )
        SELECT
            SUM(count) AS total,
            SUM(CASE WHEN day >= NOW() - INTERVAL '24 hours' THEN count ELSE 0 END) AS h24,
            SUM(CASE WHEN day >= NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS d7,
            SUM(CASE WHEN day >= NOW() - INTERVAL '30 days' THEN count ELSE 0 END) AS d30,
            json_agg(json_build_object('timestamp', day, 'count', count) ORDER BY day) AS aggregated
        FROM daily_counts
    `;
}

export function getTopCasts(fid: number, limit: number = 30) {
  return sql`
        WITH relevant_casts AS (
            SELECT hash, timestamp, parent_cast_hash is not NULL AS is_reply
            FROM casts
            WHERE 
            fid = ${fid}
            AND timestamp >= NOW() - INTERVAL '30 days'
            ORDER BY timestamp DESC
        )
        SELECT 
            c.hash,
            c.timestamp,
            c.is_reply,
            COALESCE(r.like_count::int, 0) AS like_count,
            COALESCE(r.recast_count::int, 0) AS recast_count
        FROM 
            relevant_casts c
        LEFT JOIN 
            (SELECT 
                target_cast_hash,
                SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) AS like_count,
                SUM(CASE WHEN type = 'recast' THEN 1 ELSE 0 END) AS recast_count
            FROM reactions 
            WHERE type IN ('like', 'recast')
            AND target_cast_hash IN (SELECT hash FROM relevant_casts)
            GROUP BY target_cast_hash) r ON c.hash = r.target_cast_hash
        ORDER BY 
            COALESCE(like_count::int, 0) DESC
        LIMIT ${limit};
    `;
}

export function getRecentUnfollows(fid: number, limit: number = 50) {
  return sql`
        SELECT 
          target_fid, 
          deleted_at 
        FROM
          links 
        WHERE 
          fid = ${fid}
          AND deleted_at IS NOT NULL
          AND deleted_at >= NOW() - INTERVAL '90 days'
        ORDER BY 
          deleted_at DESC
        LIMIT ${limit};
    `;
}

export const formatResponseSection = (data: any) => ({
  aggregated: data.aggregated,
  overview: {
    total: data.total,
    d7: data.d7,
    h24: data.h24,
    d30: data.d30,
  },
});
