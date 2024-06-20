import { AppDataSource, Cast, initializeDataSourceWithRetry } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    maxDuration: 30,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let { term, limit, offset } = req.query;

    if (typeof term !== 'string' || term.length < 3) {
        return res.status(400).json({ error: 'Invalid search term' });
    }
    if (!limit) {
        limit = '5';
    }

    if (!offset) {
        offset = '0';
    }

    await initializeDataSourceWithRetry();

    // replaces spaces with + for tsquery
    term = term.replace(/ /g, '+');
    try {
        const searchRepository = AppDataSource.getRepository(Cast);
        const results = await searchRepository.query(
            `SELECT hash, fid FROM casts WHERE tsv @@ to_tsquery($1) ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
            [term, limit, offset]
        );
        res.status(200).json(results);
    } catch (error) {
        console.log('error in search', error);
        res.status(500).json({ error: `Failed to fetch search results ${error}` });
    }
}