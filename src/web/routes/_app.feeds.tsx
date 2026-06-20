// Unit #6 (#754 feeds+profile) — /feeds mounted as a child of the `_app` shell (unit #5).
// Thin route: the ported page logic lives in `@/web/pages/FeedsPage` (the established
// `_app.tsx → Home` thin-route pattern). FeedsPage reuses CastRow/CompactCastRow,
// SelectableListWithHotkeys (react-virtual), SplitPaneShell/PreviewPane, the NewCastsPill,
// and the RQ feed hooks (which call the unit-#10 /api/* worker routes) VERBATIM via the
// unit-#2 next/* aliases.
import { createFileRoute } from '@tanstack/react-router';
import FeedsPage from '@/web/pages/FeedsPage';

export const Route = createFileRoute('/_app/feeds')({
  component: FeedsPage,
});
