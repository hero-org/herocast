import { AppDataSource } from '@/lib/db';

export async function getAnalyticsData(tableName: string, fid: string) {
    const query = `
        WITH hourly_counts AS (
            SELECT
                date_trunc('hour', timestamp) AS hour,
                COUNT(*) AS count
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            AND fid = $1
            GROUP BY hour
        )
        SELECT
            SUM(count) AS total,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '24 hours' THEN count ELSE 0 END) AS h24,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS d7,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '30 days' THEN count ELSE 0 END) AS d30,
            json_agg(json_build_object('timestamp', hour, 'count', count) ORDER BY hour) AS aggregated
        FROM hourly_counts
    `;

    return AppDataSource.query(query, [fid]);
}
