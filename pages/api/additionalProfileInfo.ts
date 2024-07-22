import { NextApiRequest, NextApiResponse } from 'next';
import { getSocialCapitalScore } from '@/common/helpers/airstack';

type IcebreakerData = {
  channels: {
    type: string;
    isVerified: boolean;
    isLocked: boolean;
    value: string;
    url: string;
  }[];
  credentials: {
    name: string;
    chain?: string;
    source?: string;
    reference?: string;
  }[];
};

async function getIcebreakerData(fid: string): Promise<IcebreakerData | null> {
  try {
    const response = await fetch(`https://app.icebreaker.xyz/api/v1/fid/${fid}`, {
      headers: {
        'accept': 'application/json'
      }
    });
    const data = await response.json();
    if (data && data.profiles && data?.profiles.length === 1) {
      const profile = data.profiles[0];
      return { channels: profile?.channels || [], credentials: profile?.credentials || [] };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching Icebreaker data:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { fid } = req.query;

  if (!fid || typeof fid !== 'string') {
    return res.status(400).json({ message: 'Invalid FID provided' });
  }

  try {
    const [socialCapitalScore, icebreakerData] = await Promise.all([
      getSocialCapitalScore(fid),
      getIcebreakerData(fid)
    ]);
    console.log(`icebreakerData for fid ${fid}`, icebreakerData);
    res.status(200).json({ socialCapitalScore, icebreakerData });
  } catch (error) {
    console.error('Error fetching additional profile info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
