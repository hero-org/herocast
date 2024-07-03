import { AppDataSource, Cast, initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    maxDuration: 20,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let { limit, offset } = req.query;
    const { term, interval, orderBy, filterByPowerBadge } = req.query;

    if (typeof term !== 'string' || term.length < 3) {
        return res.status(400).json({ error: 'Invalid search term' });
    }
    if (!limit) {
        limit = '5';
    }

    if (!offset) {
        offset = '0';
    }

    const start = process.hrtime();
    const timeout = setTimeout(() => {
        res.status(503).json({ error: 'Request timed out' });
    }, 19000); // 19 seconds to ensure it sends before the 20-second limit

    await initializeDataSourceWithRetry();
    const dbConnectEnd = process.hrtime(start);

    const query = `
    SELECT 
        casts.hash, casts.fid, casts.text
    FROM casts 
        ${filterByPowerBadge === 'true' ? 'JOIN powerbadge ON powerbadge.fid = casts.fid' : ''}
    WHERE 
        tsv @@ websearch_to_tsquery('english', '${term}')
        AND casts.deleted_at IS NULL
        ${interval ? `AND timestamp >= NOW() - INTERVAL '${interval}'` : ''}
        ${orderBy ? `ORDER BY ${orderBy}` : ''}
    LIMIT $1 OFFSET $2`;
    const vars = [limit, offset];

    try {
        const queryStart = process.hrtime();

        const searchRepository = AppDataSource.getRepository(Cast);
        const results = await searchRepository.query(query, vars);
        const queryEnd = process.hrtime(queryStart);
        const totalEnd = process.hrtime(start);

        console.log(`DB Connection Time: ${dbConnectEnd[0] * 1000 + dbConnectEnd[1] / 1e6} ms`);
        console.log(`Query Execution Time: ${queryEnd[0] * 1000 + queryEnd[1] / 1e6} ms`);
        console.log(`Total Request Time: ${totalEnd[0] * 1000 + totalEnd[1] / 1e6} ms`);
        console.log('Search results:', results.length)

        clearTimeout(timeout); // Clear the timeout if the request completes in time
        res.status(200).json(results);
    } catch (error) {
        clearTimeout(timeout); // Clear the timeout if the request completes in time
        console.log('error in search', error);
        res.status(500).json({ error: `Failed to fetch search results ${error}` });
    }
}