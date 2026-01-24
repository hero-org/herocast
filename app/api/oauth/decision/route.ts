import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildLoginRedirect(authorizationId: string): string {
  const redirectPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

function getOAuthHelpers(supabase: ReturnType<typeof createServerClient>) {
  const oauth = (supabase.auth as unknown as { oauth?: Record<string, unknown> }).oauth;
  return {
    approve: oauth && (oauth as { approveAuthorization?: (id: string) => Promise<any> }).approveAuthorization,
    deny: oauth && (oauth as { denyAuthorization?: (id: string) => Promise<any> }).denyAuthorization,
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const decision = formData.get('decision');
  const authorizationId = formData.get('authorization_id');

  if (typeof authorizationId !== 'string' || !authorizationId) {
    return NextResponse.json({ error: 'Missing authorization_id' }, { status: 400 });
  }

  if (decision !== 'approve' && decision !== 'deny') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => cookieStore.getAll(),
        setAll: async (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(buildLoginRedirect(authorizationId));
  }

  const { approve, deny } = getOAuthHelpers(supabase);
  if (!approve || !deny) {
    return NextResponse.json(
      { error: 'Supabase OAuth helpers are unavailable. Upgrade @supabase/supabase-js.' },
      { status: 500 }
    );
  }

  const action = decision === 'approve' ? approve : deny;
  const { data, error } = await action(authorizationId);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to update authorization' }, { status: 400 });
  }

  const redirectTo = data?.redirect_to || data?.redirect_url;
  if (!redirectTo) {
    return NextResponse.json({ error: 'Missing redirect URL' }, { status: 500 });
  }

  return NextResponse.redirect(redirectTo, { status: 303 });
}
