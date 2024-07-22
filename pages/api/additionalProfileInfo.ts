import { NextApiRequest, NextApiResponse } from 'next';
import { getSocialCapitalScore } from '@/common/helpers/airstack';

async function getIcebreakerData(fid: string) {
  try {
    const response = await fetch(`https://app.icebreaker.xyz/api/v1/fid/${fid}`, {
      headers: {
        'accept': 'application/json'
      }
    });
    const data = await response.json();
    return data.filter((item: any) => 
      item.source === 'IcebreakerEAS' && 
      ['twitter', 'linkedin', 'telegram'].includes(item.type)
    );
  } catch (error) {
    console.error('Error fetching Icebreaker data:', error);
    return [];
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
    res.status(200).json({ socialCapitalScore, icebreakerData });
  } catch (error) {
    console.error('Error fetching additional profile info:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
