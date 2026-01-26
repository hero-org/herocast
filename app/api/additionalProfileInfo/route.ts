import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getCoordinapeInfoForAddresses } from '@/common/helpers/coordinapeAttestations';
import { getIcebreakerSocialInfoForFid } from '@/common/helpers/icebreaker';

async function fetchAdditionalProfileInfoUncached(fid: number, addresses: string) {
  // Get additional profile info in parallel
  const [icebreakerInfo, coordinapeInfo] = await Promise.allSettled([
    getIcebreakerSocialInfoForFid(String(fid)),
    addresses ? getCoordinapeInfoForAddresses(addresses) : Promise.resolve(null),
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

// Create cached version with unstable_cache (works in Next.js 15 stable)
const getCachedAdditionalProfileInfo = (fid: number, addresses: string) =>
  unstable_cache(() => fetchAdditionalProfileInfoUncached(fid, addresses), [`profile-info-${fid}-${addresses}`], {
    revalidate: 21600, // 6 hours
    tags: ['profile-info'],
  })();

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

    const result = await getCachedAdditionalProfileInfo(fidNum, addresses || '');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in additionalProfileInfo route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
