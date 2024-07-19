import { NextApiRequest, NextApiResponse } from 'next';
import { getSocialCapitalScore } from '@/common/helpers/airstack';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { fid } = req.query;

  if (!fid || typeof fid !== 'string') {
    return res.status(400).json({ message: 'Invalid FID provided' });
  }

  try {
    const socialCapitalScore = await getSocialCapitalScore(fid)
    res.status(200).json({ socialCapitalScore });
  } catch (error) {
    console.error('Error fetching user assets:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
