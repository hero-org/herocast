// Unit #9 (#754 auth/accounts) — /welcome/success (the post-connect onboarding checklist).
// Thin route → `@/web/pages/WelcomeSuccessPage`. Child of the `_auth` pathless layout
// (centered, outside the app shell).
import { createFileRoute } from '@tanstack/react-router';
import WelcomeSuccessPage from '@/web/pages/WelcomeSuccessPage';

export const Route = createFileRoute('/_auth/welcome/success')({
  component: WelcomeSuccessPage,
});
