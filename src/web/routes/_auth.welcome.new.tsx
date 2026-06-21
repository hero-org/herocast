// Unit #9 (#754 auth/accounts) — /welcome/new (the create-signer onboarding entry).
// Thin route → `@/web/pages/WelcomeNewPage`, which mounts the shared CreateAccountPage
// CLIENT-ONLY (ssr:false) so @farcaster/hub-web's module-scope factory never runs during
// workerd SSR (see WelcomeNewPage for the full rationale). Child of the `_auth` pathless
// layout (centered, outside the app shell).
import { createFileRoute } from '@tanstack/react-router';
import WelcomeNewPage from '@/web/pages/WelcomeNewPage';

export const Route = createFileRoute('/_auth/welcome/new')({
  component: WelcomeNewPage,
});
