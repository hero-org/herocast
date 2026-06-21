// Unit #7 (#754 inbox-search-conversation) — /inbox mounted as a child of the `_app` shell
// (unit #5). Thin route: the ported page logic lives in `@/web/pages/InboxPage` (the
// established `_app.tsx → Home` thin-route pattern). InboxPage reuses CastRow,
// SelectableListWithHotkeys (react-virtual), the notification/navigation/account/draft
// stores, and the FarcasterProvider seam (→ the unit-#10 /api/notifications + /api/casts
// worker routes) VERBATIM via the unit-#2 next/* aliases. INP `inp:open-notification` is
// already wired in the page.
import { createFileRoute } from '@tanstack/react-router';
import InboxPage from '@/web/pages/InboxPage';

export const Route = createFileRoute('/_app/inbox')({
  component: InboxPage,
});
