import { NextApiRequest, NextApiResponse } from 'next';
import { getAirstackSocialInfoForFid } from '@/common/helpers/airstack';
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
    const [airstackSocialInfo, icebreakerSocialInfo] = await Promise.all([
      getAirstackSocialInfoForFid(fid),
      getIcebreakerSocialInfoForFid(fid),
      // getCoordinapeInfoForAddresses(addresses as string[]),
    ]);
    res.status(200).json({ airstackSocialInfo, icebreakerSocialInfo });
  } catch (error) {
    console.error('Error fetching additional profile info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
