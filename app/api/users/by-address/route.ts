import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { BulkUserAddressTypes } from '@neynar/nodejs-sdk/build/neynar-api/common/constants';

const API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;

type User = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
};

async function fetchUserByEthereumAddressUncached(address: string): Promise<User | null> {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  const neynarClient = new NeynarAPIClient(API_KEY);

  try {
    const response = await neynarClient.fetchBulkUsersByEthereumAddress([address.toLowerCase()], {
      addressTypes: [BulkUserAddressTypes.VERIFIED_ADDRESS],
    });

    // Response is a map of address -> User[]
    const users = response[address.toLowerCase()] || [];

    if (users.length === 0) {
      return null;
    }

    // Return the first user if multiple are found
    const user = users[0];
    return {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name || user.username,
      pfp_url: user.pfp_url,
    };
  } catch (error: any) {
    // Neynar returns 404 when no users found - this is expected, not an error
    if (error?.response?.status === 404 || error?.status === 404) {
      return null;
    }
    console.error('[users/by-address] Error fetching user:', error);
    throw error;
  }
}

// Create cached version with unstable_cache
// User verified addresses are relatively stable, so we cache for 30 days
const getCachedUserByAddress = (address: string) =>
  unstable_cache(() => fetchUserByEthereumAddressUncached(address), [`user-by-address-${address.toLowerCase()}`], {
    revalidate: 2592000, // 30 days
    tags: ['users', 'user-by-address'],
  })();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Missing required parameter: address' }, { status: 400 });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const user = await getCachedUserByAddress(address);

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('[users/by-address] Error in route handler:', error);

    // Handle Neynar SDK errors
    if (error.response) {
      return NextResponse.json(
        { error: error.response.data?.message || 'External API error' },
        { status: error.response.status }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch user by address' }, { status: 500 });
  }
}

export const maxDuration = 20;
