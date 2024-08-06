import { AppDataSource } from "./db.ts";

export async function getAnalyticsData(tableName: string, fid: string, fidFilterColumn: string = 'fid') {
    console.log('getAnalyticsData', fid, tableName);
    const query = `
        WITH daily_counts AS (
            SELECT
                date_trunc('day', timestamp) AS day,
                COUNT(*) AS count
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            AND ${fidFilterColumn} = $1
            GROUP BY day
        )
        SELECT
            SUM(count) AS total,
            SUM(CASE WHEN day >= NOW() - INTERVAL '24 hours' THEN count ELSE 0 END) AS h24,
            SUM(CASE WHEN day >= NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS d7,
            json_agg(json_build_object('timestamp', day, 'count', count) ORDER BY day) AS aggregated
        FROM daily_counts
    `;
    await AppDataSource.query(`SET work_mem TO '32MB';`);
    return AppDataSource.query(query, [fid]);
}

// SUM(CASE WHEN day >= NOW() - INTERVAL '30 days' THEN count ELSE 0 END) AS d30,
