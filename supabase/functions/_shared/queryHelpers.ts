import { sql } from 'kysely'

export function buildAnalyticsQuery(tableName: string, fid: string, fidFilterColumn: string) {
    console.log('buildAnalyticsQuery', fid, tableName);
    return sql`
        WITH daily_counts AS (
            SELECT
                date_trunc('day', timestamp) AS day,
                COUNT(*) AS count
            FROM ${sql.table(tableName)}
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            AND ${sql.ref(fidFilterColumn)} = ${fid}
            GROUP BY day
        )
        SELECT
            SUM(count) AS total,
            SUM(CASE WHEN day >= NOW() - INTERVAL '24 hours' THEN count ELSE 0 END) AS h24,
            SUM(CASE WHEN day >= NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS d7,
            json_agg(json_build_object('timestamp', day, 'count', count) ORDER BY day) AS aggregated
        FROM daily_counts
    `;
}

export function getCastsOverview(fid: number, limit: number = 30) {
    return sql`
        WITH relevant_casts AS (
            SELECT hash, timestamp, parent_cast_hash is not NULL AS is_reply
            FROM casts
            WHERE fid = ${fid}
            ORDER BY timestamp DESC
            LIMIT ${limit}
        )
        SELECT 
            c.hash,
            c.timestamp,
            c.is_reply,
            COALESCE(r.like_count, 0) AS like_count,
            COALESCE(r.recast_count, 0) AS recast_count
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
            c.timestamp DESC;
    `;
}
