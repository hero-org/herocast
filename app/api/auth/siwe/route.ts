import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('SIWE API', searchParams, request.method, request.headers);

    return NextResponse.redirect('/');
  } catch (error) {
    console.error('Error in SIWE route:', error);
    return NextResponse.redirect('/');
  }
}
