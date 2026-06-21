// Unit #9 (#754 auth/accounts) — /welcome/new (the create-signer onboarding entry).
// In the Next tree app/(auth)/welcome/new/page.tsx re-exports CreateAccountPage; here it
// must mount CLIENT-ONLY.
//
// Why ssr:false: CreateAccountPage → warpcastLogin → @farcaster/hub-web, whose single-file
// bundle runs `Factory.build()` → `randomBytes` (@noble/hashes crypto.getRandomValues) AT
// MODULE SCOPE. workerd forbids random-gen in global scope, so importing that chunk during
// SSR throws ("Disallowed operation called within global scope") and the page renders empty.
// The account-creation flow (generateWarpcastSigner keygen) is inherently client-side
// anyway, so we load CreateAccountPage through the next/dynamic shim (ssr:false): the chunk
// is never imported on the server (the lazy loader isn't invoked during SSR), so the factory
// never runs there; the real component mounts after hydration. (The wallet route pages —
// /accounts, /welcome/connect — instead drop their whole graph out of the worker via the
// `ssrClientOnlyModules` stub because they're already SSR-gated; /welcome/new is NOT gated,
// so it uses the ssr:false dynamic boundary to avoid rendering anything that pulls hub-web.)
import dynamic from '@/web/lib/dynamic';

const CreateAccountPage = dynamic(
  () => import('@/common/components/CreateAccountPage').then((m) => ({ default: m.CreateAccountPage })),
  { ssr: false, loading: () => null }
);

export default function WelcomeNewPage() {
  return <CreateAccountPage />;
}
