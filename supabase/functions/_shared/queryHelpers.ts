import { sql, Kysely } from 'kysely'

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

export function getCastsOverview(fid: number) {
    return sql`
        SELECT 
            c.hash,
            c.text,
            c.timestamp,
            COALESCE(l.like_count, 0) AS like_count,
            COALESCE(r.recast_count, 0) AS recast_count
        FROM 
            casts c
        LEFT JOIN 
            (SELECT target_hash, COUNT(*) AS like_count 
             FROM reactions 
             WHERE reaction_type = 'like' 
             GROUP BY target_hash) l ON c.hash = l.target_hash
        LEFT JOIN 
            (SELECT target_hash, COUNT(*) AS recast_count 
             FROM reactions 
             WHERE reaction_type = 'recast' 
             GROUP BY target_hash) r ON c.hash = r.target_hash
        WHERE 
            c.fid = ${fid}
        ORDER BY 
            c.timestamp DESC
    `;
}
