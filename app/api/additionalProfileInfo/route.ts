import { NextRequest, NextResponse } from 'next/server';
import { getIcebreakerSocialInfoForFid } from '@/common/helpers/icebreaker';
import { getCoordinapeInfoForAddresses } from '@/common/helpers/coordinapeAttestations';

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

    // Get additional profile info in parallel
    const [icebreakerInfo, coordinapeInfo] = await Promise.allSettled([
      getIcebreakerSocialInfoForFid(fidNum),
      addresses ? getCoordinapeInfoForAddresses(addresses.split(',')) : Promise.resolve(null),
    ]);

    const result: any = {};

    if (icebreakerInfo.status === 'fulfilled') {
      result.icebreaker = icebreakerInfo.value;
    }

    if (coordinapeInfo.status === 'fulfilled' && coordinapeInfo.value) {
      result.coordinape = coordinapeInfo.value;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in additionalProfileInfo route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
