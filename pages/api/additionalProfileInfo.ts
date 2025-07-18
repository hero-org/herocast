import { NextApiRequest, NextApiResponse } from 'next';
import { getIcebreakerSocialInfoForFid } from '@/common/helpers/icebreaker';
import { getCoordinapeInfoForAddresses } from '@/common/helpers/coordinapeAttestations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { fid, addresses } = req.query;

  if (!fid || typeof fid !== 'string') {
    return res.status(400).json({ message: 'Invalid FID provided' });
  }

  try {
    const [icebreakerSocialInfo, coordinapeAttestations] = await Promise.all([
      getIcebreakerSocialInfoForFid(fid),
      addresses ? getCoordinapeInfoForAddresses(addresses.toString()) : [],
    ]);
    res.status(200).json({ icebreakerSocialInfo, coordinapeAttestations });
  } catch (error) {
    console.error('Error fetching additional profile info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
