import { cacheLife } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getIcebreakerSocialInfoForFid } from '@/common/helpers/icebreaker';
import { getCoordinapeInfoForAddresses } from '@/common/helpers/coordinapeAttestations';

async function fetchAdditionalProfileInfo(fid: number, addresses: string) {
  'use cache';
  cacheLife({
    stale: 60 * 60, // 1 hour - serve stale content
    revalidate: 60 * 60 * 6, // 6 hours - revalidate
    expire: 60 * 60 * 24, // 1 day - purge from cache
  });

  // Get additional profile info in parallel
  const [icebreakerInfo, coordinapeInfo] = await Promise.allSettled([
    getIcebreakerSocialInfoForFid(fid),
    addresses ? getCoordinapeInfoForAddresses(addresses.split(',')) : Promise.resolve(null),
  ]);

  const result: any = {};

  if (icebreakerInfo.status === 'fulfilled') {
    result.icebreaker = icebreakerInfo.value;
  }

  if (coordinapeInfo.status === 'fulfilled' && coordinapeInfo.value) {
    result.coordinape = coordinapeInfo.value;
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const addresses = searchParams.get('addresses');

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
    }

    const fidNum = parseInt(fid, 10);
    if (isNaN(fidNum)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const result = await fetchAdditionalProfileInfo(fidNum, addresses || '');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in additionalProfileInfo route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
