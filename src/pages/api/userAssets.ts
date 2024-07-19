import { NextApiRequest, NextApiResponse } from 'next';
import { getTokenBalances, getNFTsOwned } from '../../common/helpers/airstack';
import { getFarcasterUserByFid } from '../../common/helpers/neynar';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { fid } = req.query;

  if (!fid || typeof fid !== 'string') {
    return res.status(400).json({ message: 'Invalid FID provided' });
  }

  try {
    // Get the user's Ethereum address using the Neynar API
    const user = await getFarcasterUserByFid(parseInt(fid));
    if (!user || !user.verifications || user.verifications.length === 0) {
      return res.status(404).json({ message: 'User not found or no verified addresses' });
    }

    const address = user.verifications[0];

    // Fetch token balances and NFTs owned
    const [tokenBalances, nftsOwned] = await Promise.all([
      getTokenBalances(address),
      getNFTsOwned(address)
    ]);

    res.status(200).json({
      address,
      tokenBalances,
      nftsOwned
    });
  } catch (error) {
    console.error('Error fetching user assets:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
