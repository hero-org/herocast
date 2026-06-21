// Unit #9 (#754 auth/accounts) — /welcome/connect (QR + signer-poll onboarding step).
// Thin route → `@/web/pages/WelcomeConnectPage`. Child of the `_auth` pathless layout
// (centered, outside the app shell). A WALLET_ROUTE (unit #3) → wagmi/rainbowkit mount
// client-only; the page never renders during SSR.
import { createFileRoute } from '@tanstack/react-router';
import WelcomeConnectPage from '@/web/pages/WelcomeConnectPage';

export const Route = createFileRoute('/_auth/welcome/connect')({
  component: WelcomeConnectPage,
});
