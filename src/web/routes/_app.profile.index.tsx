// Unit #6 (#754 feeds+profile) — /profile index (the app/(app)/profile/page.tsx
// equivalent): redirects to the selected account's /profile/<username>. Sibling
// _app.profile.$slug.tsx serves the real profile page; TanStack flat-routing auto-creates
// the shared /profile parent, so no explicit _app.profile.tsx is needed.
import { createFileRoute } from '@tanstack/react-router';
import ProfileIndexPage from '@/web/pages/ProfileIndexPage';

export const Route = createFileRoute('/_app/profile/')({
  component: ProfileIndexPage,
});
