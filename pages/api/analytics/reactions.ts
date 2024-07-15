import { Analytics } from '@/common/types/types';
import { initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAnalyticsData } from './queryHelpers';

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
        const result = await getAnalyticsData('reactions', fid, 'target_cast_fid');

        const analytics: Omit<Analytics, 'follows' | 'casts'> = {
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
        };

        clearTimeout(timeout);
        res.status(200).json(analytics);
    } catch (error) {
        clearTimeout(timeout);
        console.log('error in analytics', error);
        res.status(500).json({ error: `Failed to fetch analytics: ${error?.message || error}` });
    }
}
