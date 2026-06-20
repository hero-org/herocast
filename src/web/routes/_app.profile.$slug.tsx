// Unit #6 (#754 feeds+profile) — /profile/<slug> (the app/(app)/profile/[slug]/page.tsx
// equivalent). The `$slug` param name matches the Next [slug] segment, so the unit-#2
// useParams() adapter ({ strict: false } → { slug }) feeds the ported page unchanged.
// ProfilePage reuses ProfileInfo, the casts/replies/top/likes/channels tabs, and CastRow
// (→ Embeds → VideoEmbed, kept out of the worker bundle via the ssr stub in
// vite.config.mts) plus useProfile/useProfileFeed/useUserChannels (→ #10 /api/* routes),
// all VERBATIM via the unit-#2 next/* aliases.
import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@/web/pages/ProfilePage';

export const Route = createFileRoute('/_app/profile/$slug')({
  component: ProfilePage,
});
