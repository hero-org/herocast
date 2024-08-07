import { sql, Kysely } from 'kysely'

export function buildAnalyticsQuery(tableName: string, fid: string, fidFilterColumn: string = 'fid') {
    console.log('buildAnalyticsQuery', fid, tableName);
    return sql`
        WITH daily_counts AS (
            SELECT
                date_trunc('day', timestamp) AS day,
                COUNT(*) AS count
            FROM ${sql.table(tableName)}
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            AND ${sql.identifier(fidFilterColumn)} = ${fid}
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

export async function getAnalyticsData(db: Kysely<any>, tableName: string, fid: string, fidFilterColumn: string = 'fid') {
    const query = buildAnalyticsQuery(tableName, fid, fidFilterColumn);
    return await db.selectFrom(query.as('analytics_data'))
        .selectAll()
        .executeTakeFirst();
}
