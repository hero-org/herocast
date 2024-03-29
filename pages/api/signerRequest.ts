import type { NextApiRequest, NextApiResponse } from 'next'
import { createSignerRequest, getSignerRequestStatus } from '../../src/common/helpers/warpcastLogin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const requestMethod = req.method;

    if (requestMethod === "POST") {
        const body = JSON.parse(req.body);
        const signerRequestResult = await createSignerRequest(body)
        return res
            .status(200)
            .json(signerRequestResult);
    } else if (requestMethod === "GET") {
        const signerToken = req.query.signerToken as string;
        const signerStatus = await getSignerRequestStatus(signerToken)
        return res.status(200).json(signerStatus);
    }
}