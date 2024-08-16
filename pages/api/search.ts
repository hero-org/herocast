import { getTextMatchCondition } from '@/common/helpers/search';
import { AppDataSource, Cast, initializeDataSourceWithRetry } from '@/lib/db';
import uniqBy from 'lodash.uniqby';
import { orderBy as orderByFn } from 'lodash';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    maxDuration: 20,
};

const timeoutThreshold = 19000; // 19 seconds to ensure it sends before the 20-second limit
const TIMEOUT_ERROR_MESSAGE = 'Request timed out';
const powerbadgeFilter = 'AND casts.fid IN (SELECT fid FROM powerbadge)';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let { limit, offset } = req.query;
    const { term, interval, orderBy, onlyPowerBadge, hideReplies, mentionFid, fromFid } = req.query;

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
        res.status(503).json({ error: TIMEOUT_ERROR_MESSAGE, results: [], isTimeout: true });
    }, timeoutThreshold);

    await initializeDataSourceWithRetry();
    const dbConnectEnd = process.hrtime(start);

    const baseConditions = `
        casts.deleted_at IS NULL
        ${hideReplies === 'true' ? 'AND casts.parent_cast_hash IS NULL' : ''}
        ${interval ? `AND timestamp >= NOW() - INTERVAL '${interval}'` : ''}
        ${fromFid ? `AND casts.fid = ${fromFid}` : ''}
        `;

    const textMatchCondition = getTextMatchCondition(term);
    const query = `
    (SELECT 
        casts.hash, casts.fid, casts.text, casts.timestamp
    FROM casts 
    WHERE 
        ${baseConditions}
        AND ${textMatchCondition}
        ${onlyPowerBadge === 'true' ? powerbadgeFilter : ''}
        ${orderBy ? `ORDER BY ${orderBy}` : 'ORDER BY timestamp DESC'}
        LIMIT $1 OFFSET $2
    )
    ${mentionFid ? `
        UNION ALL
        (SELECT 
            casts.hash, casts.fid, casts.text, casts.timestamp
        FROM casts 
        WHERE 
            ${baseConditions}
            AND array_length(casts.mentions, 1) > 0
            AND casts.mentions @> ARRAY[${mentionFid}]      
            ${onlyPowerBadge === 'true' ? powerbadgeFilter : ''}
            ${orderBy ? `ORDER BY ${orderBy}` : 'ORDER BY timestamp DESC'}
            LIMIT $1 OFFSET $2
        )`: ''
        }
    `;
    const vars = [limit, offset];

    try {
        const queryStart = process.hrtime();
        await AppDataSource.query(`SET statement_timeout TO '19s';`);

        const searchRepository = AppDataSource.getRepository(Cast);
        const results = await Promise.race([
            searchRepository.query(query, vars),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), timeoutThreshold))
        ]);
        const queryEnd = process.hrtime(queryStart);
        const totalEnd = process.hrtime(start);

        console.log(`DB Connection Time: ${dbConnectEnd[0] * 1000 + dbConnectEnd[1] / 1e6} ms`);
        console.log(`Query Execution Time: ${queryEnd[0] * 1000 + queryEnd[1] / 1e6} ms`);
        console.log(`Total Request Time: ${totalEnd[0] * 1000 + totalEnd[1] / 1e6} ms`);
        console.log('Search results:', results.length)
        // uniqBy hash
        const orderedResults = orderByFn(uniqBy(results, 'hash'), ['timestamp'], ['desc']);
        clearTimeout(timeout); // Clear the timeout if the request completes in time
        res.status(200).json({ results: orderedResults });
    } catch (error) {
        clearTimeout(timeout); // Clear the timeout if the request completes in time
        console.log('error in search', error);
        res.status(500).json({ error: `Failed to fetch search results: ${error?.message || error}`, results: [] });
    }
}
