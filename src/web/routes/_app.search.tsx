// Unit #7 (#754 inbox-search-conversation) — /search mounted as a child of the `_app` shell
// (unit #5). Thin route: the ported page logic lives in `@/web/pages/SearchPage`. SearchPage
// reuses SearchInterface, SearchResultsView, CastThreadView, and the useCastSearchInfinite
// RQ hook (→ the unit-#10 /api/search worker route) VERBATIM via the unit-#2 next/* aliases.
import { createFileRoute } from '@tanstack/react-router';
import SearchPage from '@/web/pages/SearchPage';

export const Route = createFileRoute('/_app/search')({
  component: SearchPage,
});
