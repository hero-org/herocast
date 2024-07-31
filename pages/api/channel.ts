import { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { channelUrl } = req.query;
  console.log('/channel API', channelUrl)
  if (!channelUrl || typeof channelUrl !== 'string') {
    return res.status(400).json({ message: 'Invalid channelUrl provided' });
  }

  try {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json', api_key: process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      }
    };

    const payload = await fetch(`https://api.neynar.com/v2/farcaster/channel?id=${channelUrl}&type=parent_url`, options)
      .then(response => response.json())
      .catch(err => console.error(err));
    const channel = payload?.channel;
    console.log('channel in /api/channel', channel)
    res.status(200).json({ channel });
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
