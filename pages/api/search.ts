import { AppDataSource, Cast, initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    maxDuration: 20,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let { limit, offset } = req.query;
    const { term, interval, orderBy, onlyPowerBadge, hideReplies, matchFid, fromFid } = req.query;

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

    const termsInQuotes = term.match(/"([^"]*)"/g)?.map(quotedTerm => quotedTerm.replace(/"/g, ''));
    const baseConditions = `
        casts.deleted_at IS NULL
        ${hideReplies === 'true' ? 'AND casts.parent_cast_hash IS NULL' : ''}
        ${interval ? `AND timestamp >= NOW() - INTERVAL '${interval}'` : ''}
        ${termsInQuotes ? `AND ${termsInQuotes.map((quotedTerm) => `casts.text ilike '%${quotedTerm}%'`).join(' AND ')}` : ''}
        ${fromFid ? `AND casts.fid = ${fromFid}` : ''}
    `;

    const query = `
    (SELECT 
        casts.hash, casts.fid, casts.text, casts.timestamp
    FROM casts 
        ${onlyPowerBadge === 'true' ? 'JOIN powerbadge ON powerbadge.fid = casts.fid' : ''}
    WHERE 
        tsv @@ websearch_to_tsquery('english', $3) 
        AND ${baseConditions})
    UNION
    (SELECT 
        casts.hash, casts.fid, casts.text, casts.timestamp
    FROM casts 
        ${onlyPowerBadge === 'true' ? 'JOIN powerbadge ON powerbadge.fid = casts.fid' : ''}
    WHERE 
        $3::int = ANY(casts.mentions)
        AND ${baseConditions})
    ORDER BY timestamp DESC
    LIMIT $1 OFFSET $2`;
    
    const vars = [limit, offset, term.trim()];

    try {
        const queryStart = process.hrtime();
        await AppDataSource.query(`SET work_mem TO '32MB'; SET statement_timeout TO '19s';`);

        const searchRepository = AppDataSource.getRepository(Cast);
        const results = await Promise.race([
            searchRepository.query(query, vars),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 19000))
        ]);
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
        res.status(500).json({ error: `Failed to fetch search results: ${error?.message || error}` });
    }
}
