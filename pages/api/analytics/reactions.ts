import { Analytics } from '@/common/types/types';
import { initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAnalyticsData } from '../../../supabase/functions/_shared/queryHelpers';

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


        clearTimeout(timeout);
        res.status(200).json(analytics);
    } catch (error) {
        clearTimeout(timeout);
        console.log('error in analytics', error);
        res.status(500).json({ error: `Failed to fetch analytics: ${error?.message || error}` });
    }
}
