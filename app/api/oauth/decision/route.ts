import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildLoginRedirect(authorizationId: string): string {
  const redirectPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

type OAuthHelpers = {
  approve?: (id: string, opts?: { scopes?: string[] }) => Promise<any>;
  deny?: (id: string) => Promise<any>;
  getDetails?: (id: string) => Promise<any>;
};

function getOAuthHelpers(supabase: ReturnType<typeof createServerClient>): OAuthHelpers {
  const oauth = (supabase.auth as unknown as { oauth?: Record<string, unknown> }).oauth;
  if (!oauth) return {};
  return {
    approve: (oauth as { approveAuthorization?: OAuthHelpers['approve'] }).approveAuthorization,
    deny: (oauth as { denyAuthorization?: OAuthHelpers['deny'] }).denyAuthorization,
    getDetails: (oauth as { getAuthorizationDetails?: OAuthHelpers['getDetails'] }).getAuthorizationDetails,
  };
}

/**
 * Parse approved scopes from the form submission. Supports both
 * `scopes` (JSON array string) and multi-valued `scope` form fields.
 * Returns `null` if the form did not specify any — meaning caller should
 * accept whatever scopes the stored authorization request carries.
 */
function parseApprovedScopes(formData: FormData): string[] | null {
  const scopesField = formData.get('scopes');
  if (typeof scopesField === 'string' && scopesField.length > 0) {
    try {
      const parsed = JSON.parse(scopesField);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string');
      }
    } catch {
      // fall through to space-separated parse
    }
    return scopesField.trim().split(/\s+/).filter(Boolean);
  }
  const multi = formData.getAll('scope').filter((v): v is string => typeof v === 'string' && v.length > 0);
  return multi.length > 0 ? multi : null;
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

  const { approve, deny, getDetails } = getOAuthHelpers(supabase);
  if (!approve || !deny) {
    return NextResponse.json(
      { error: 'Supabase OAuth helpers are unavailable. Upgrade @supabase/supabase-js.' },
      { status: 500 }
    );
  }

  if (decision === 'deny') {
    const { data, error } = await deny(authorizationId);
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update authorization' }, { status: 400 });
    }
    const redirectTo = data?.redirect_to || data?.redirect_url;
    if (!redirectTo) {
      return NextResponse.json({ error: 'Missing redirect URL' }, { status: 500 });
    }
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  // APPROVE path — validate that any user-submitted scope set is a subset
  // of the stored authorization request's scopes. A malicious client cannot
  // widen permissions beyond what they initially requested, and a tampered
  // consent form cannot grant scopes the user never saw described.
  const approvedScopes = parseApprovedScopes(formData);
  let effectiveScopes: string[] | undefined;

  if (approvedScopes && getDetails) {
    const { data: details, error: detailsError } = await getDetails(authorizationId);
    if (detailsError) {
      return NextResponse.json({ error: detailsError.message || 'Failed to load authorization' }, { status: 400 });
    }
    const allowed = Array.isArray(details?.scopes) ? (details.scopes as string[]) : [];
    const outOfBand = approvedScopes.filter((s) => !allowed.includes(s));
    if (outOfBand.length > 0) {
      return NextResponse.json(
        { error: 'requested scopes exceed the authorization set', invalid: outOfBand },
        { status: 400 }
      );
    }
    effectiveScopes = approvedScopes;
  }

  // TODO: Full scope-threading in the OAuth token payload depends on Supabase's
  // approveAuthorization signature. Current @supabase/supabase-js typings do not
  // document a scopes option, so we pass it opportunistically — the helper will
  // use it when supported and ignore it otherwise. If the installed version
  // doesn't honor it, the token receives the scopes from the stored
  // authorization request, which already went through user consent.
  const { data, error } = effectiveScopes
    ? await approve(authorizationId, { scopes: effectiveScopes })
    : await approve(authorizationId);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to update authorization' }, { status: 400 });
  }

  const redirectTo = data?.redirect_to || data?.redirect_url;
  if (!redirectTo) {
    return NextResponse.json({ error: 'Missing redirect URL' }, { status: 500 });
  }

  return NextResponse.redirect(redirectTo, { status: 303 });
}
