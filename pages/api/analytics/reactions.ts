import { Analytics } from '@/common/types/types';
import { AppDataSource, initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    maxDuration: 20,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { fid } = req.query;

    if (!fid || typeof fid !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing fid parameter' });
    }

    const timeout = setTimeout(() => {
        res.status(503).json({ error: 'Request timed out' });
    }, 19000); // 19 seconds to ensure it sends before the 20-second limit

    await initializeDataSourceWithRetry();

    try {
        const reactionQuery = `
            WITH hourly_counts AS (
                SELECT
                    date_trunc('hour', timestamp) AS hour,
                    COUNT(*) AS count
                FROM reactions
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

        const result = await AppDataSource.query(reactionQuery, [fid]);

        const analytics: Analytics = {
            updatedAt: Date.now(),
            reactions: {
                overview: {
                    total: parseInt(result[0].total) || 0,
                    h24: parseInt(result[0].h24) || 0,
                    d7: parseInt(result[0].d7) || 0,
                    d30: parseInt(result[0].d30) || 0,
                },
                aggregated: result[0].aggregated || [],
            },
            follows: { overview: { total: 0, h24: 0, d7: 0, d30: 0 }, aggregated: [] },
            casts: { overview: { total: 0, h24: 0, d7: 0, d30: 0 }, aggregated: [] },
        };

        clearTimeout(timeout);
        res.status(200).json(analytics);
    } catch (error) {
        clearTimeout(timeout);
        console.log('error in analytics', error);
        res.status(500).json({ error: `Failed to fetch analytics: ${error?.message || error}` });
    }
}
