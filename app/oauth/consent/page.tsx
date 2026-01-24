import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type ConsentPageProps = {
  searchParams: {
    authorization_id?: string;
  };
};

function buildLoginRedirect(authorizationId: string): string {
  const redirectPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const authorizationId = searchParams.authorization_id;

  if (!authorizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Authorization error</CardTitle>
            <CardDescription>Missing authorization_id in request.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
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
    redirect(buildLoginRedirect(authorizationId));
  }

  const oauth = (supabase.auth as unknown as { oauth?: Record<string, unknown> }).oauth;
  const getAuthorizationDetails =
    oauth && (oauth as { getAuthorizationDetails?: (id: string) => Promise<any> }).getAuthorizationDetails;

  if (!getAuthorizationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>OAuth not ready</CardTitle>
            <CardDescription>
              Supabase OAuth helper methods are unavailable. Upgrade <code>@supabase/supabase-js</code> and ensure OAuth
              2.1 Server is enabled.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data: authDetails, error } = await getAuthorizationDetails(authorizationId);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Authorization error</CardTitle>
            <CardDescription>{error.message || 'Invalid authorization request.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const redirectUrl = authDetails?.redirect_url || authDetails?.redirect_to;
  if (redirectUrl) {
    redirect(redirectUrl);
  }

  const clientName = authDetails?.client?.name || authDetails?.client?.client_name || 'Unknown client';
  const redirectUri = authDetails?.redirect_uri || authDetails?.redirectUrl || 'Unknown';
  const scopes = Array.isArray(authDetails?.scopes) ? authDetails.scopes : [];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Authorize {clientName}</CardTitle>
          <CardDescription>This app wants permission to access your Herocast account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <div>
              <span className="font-semibold text-foreground">Client:</span> {clientName}
            </div>
            <div>
              <span className="font-semibold text-foreground">Redirect URI:</span> {redirectUri}
            </div>
            {scopes.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Requested scopes:</span>
                <ul className="mt-2 list-disc list-inside">
                  {scopes.map((scope: string) => (
                    <li key={scope}>{scope}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <form action="/api/oauth/decision" method="POST" className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <input type="hidden" name="authorization_id" value={authorizationId} />
            <Button type="submit" name="decision" value="deny" variant="outline">
              Deny
            </Button>
            <Button type="submit" name="decision" value="approve">
              Approve
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
