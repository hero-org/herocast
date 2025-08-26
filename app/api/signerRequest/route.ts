import { NextRequest, NextResponse } from 'next/server';
import { createSignerRequest, getSignerRequestStatus } from '@/common/helpers/warpcastLogin';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const signerRequestResult = await createSignerRequest(body);
  return NextResponse.json(signerRequestResult, { status: 200 });
}
export async function GET(request: NextRequest) {
  const signerToken = request.nextUrl.searchParams.get('signerToken');
  const signerStatus = await getSignerRequestStatus(signerToken);
  return NextResponse.json(signerStatus, { status: 200 });
}