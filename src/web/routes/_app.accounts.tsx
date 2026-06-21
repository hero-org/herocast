// Unit #9 (#754 auth/accounts) — /accounts mounted as a child of the `_app` shell (unit #5).
// In the Next tree this is app/(app)/accounts → it gets the full app chrome (sidebar,
// titlebar "Accounts"). Thin route: the ported page logic lives in `@/web/pages/AccountsPage`,
// reusing the shared account-management components (QrCode, SwitchWalletButton,
// ConfirmOnchainSignerButton, AccountManagementModal) + the wagmi/rainbowkit providers
// (route-scoped via the unit-#3 WALLET_ROUTES) VERBATIM.
import { createFileRoute } from '@tanstack/react-router';
import AccountsPage from '@/web/pages/AccountsPage';

export const Route = createFileRoute('/_app/accounts')({
  component: AccountsPage,
});
