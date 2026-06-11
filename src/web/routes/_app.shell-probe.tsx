// THROWAWAY / INTERNAL — unit #5 (app shell + sidebar + command palette) probe. Deleted
// at/before cutover (#13). Mirrors stores-probe.tsx et al., but lives UNDER the `_app`
// pathless layout so requesting /shell-probe SSRs the full Home chrome around it:
// desktop sidebar (herocast lockup + LeftSidebarNav), titlebar, right-sidebar slot,
// NewCastModal mount point, Toaster.
//
// What a 200 here proves on real workerd, with NO secrets configured (forkability bar):
//   - the entire shell graph (src/home, Sidebar/*, CommandPalette/*, GlobalHotkeys,
//     headlessui, cmdk, sonner, SidebarProvider) evaluates without import-time throws
//     (the unit-#4 H6/H7 hazard class) and renders via zustand's server-snapshot path
//   - the unit-#2 next/* aliases carry the UNTOUCHED shared components end-to-end
//   - the children slot SSRs the `isHydrated=false` "Loading herocast" gate — the same
//     pre-hydration paint the live Next app produces; the probe body below only appears
//     after client-mount store hydration (i.e. logged in), which is the point: it is
//     EVIDENCE of initializeStoresProgressive() having run, not SSR content.
//
// NOTE: logged-out browsers are client-redirected to /login by AuthContext (didLoad +
// no user) — expected; the SSR HTML is still the full shell (verify with curl).
import { createFileRoute } from '@tanstack/react-router';
import { useAccountStore } from '@/stores/useAccountStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

export const Route = createFileRoute('/_app/shell-probe')({
  component: ShellProbe,
});

function ShellProbe() {
  // Rendering at all means the store init gate (pageRequiresHydrate && !isHydrated)
  // opened — i.e. initializeStoresProgressive() ran on the client and hydrateMinimal()
  // flipped isHydrated. These reads are the evidence panel.
  const isHydrated = useAccountStore((s) => s.isHydrated);
  const accountCount = useAccountStore((s) => s.accounts.length);
  const isCommandPaletteOpen = useNavigationStore((s) => s.isCommandPaletteOpen);

  return (
    <div className="p-6 space-y-2 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold text-foreground">shell-probe — unit #5 (throwaway)</h2>
      <p className="text-sm text-muted-foreground">
        You are seeing this inside the ported app shell: sidebar on the left, titlebar above, command palette on cmd+k.
      </p>
      <ul className="text-sm text-foreground space-y-1">
        <li>
          account store hydrated: <code>{String(isHydrated)}</code> (true ⇒ initializeStoresProgressive ran on client
          mount)
        </li>
        <li>
          accounts loaded: <code>{accountCount}</code>
        </li>
        <li>
          command palette open: <code>{String(isCommandPaletteOpen)}</code> (toggle with cmd+k / ctrl+k)
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Sidebar links to /feeds, /inbox, … hit the router&apos;s not-found until units #6–#9/#12 land those pages.
      </p>
    </div>
  );
}
