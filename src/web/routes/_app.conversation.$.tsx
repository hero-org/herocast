// Unit #7 (#754 inbox-search-conversation) — /conversation/<hash> (the
// app/conversation/[...slug]/page.tsx equivalent, whose own layout.tsx also wraps children
// in <Home>, so mounting under the `_app` shell matches). This is the deep-link target of the
// unit-#6 mobile cast tap (`router.push('/conversation/<hash>')`) and the legacy ?castHash=
// redirect that #6 ported intact — it 404'd on the canary until this unit landed.
//
// The Next source is a `[...slug]` CATCH-ALL (handles /conversation/<hash> AND
// /conversation/<user>/<hash>), so it maps to a TanStack `$` SPLAT route — NOT a single
// `$hash` segment. The param arrives as `_splat` (a single "a/b" string); ConversationPage
// rebuilds the Next-shaped slug array from it (see C4 there). SSR shape: /conversation* is
// excluded from Home.pageRequiresHydrate, so it SSRs content (like /profile), gated by the
// page's own loading state until the client React Query resolves — CastThreadView →
// Embeds → VideoEmbed therefore never renders during SSR (the #6 worker-bundle stub holds).
// Reuses CastThreadView + the provider seam (→ the unit-#10 /api/casts/lookup route) VERBATIM.
import { createFileRoute } from '@tanstack/react-router';
import ConversationPage from '@/web/pages/ConversationPage';

export const Route = createFileRoute('/_app/conversation/$')({
  component: ConversationPage,
});
