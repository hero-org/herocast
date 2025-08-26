'use client';

import React, { useEffect } from 'react';
import { HotkeysProvider, useHotkeysContext } from 'react-hotkeys-hook';
import { useRouter } from 'next/router';
import { getScopesForPage, HotkeyScopes } from '@/common/constants/hotkeys';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useDataStore } from '@/stores/useDataStore';

interface AppHotkeysProviderProps {
  children: React.ReactNode;
}

// Component to manage scope changes based on app state
function ScopeManager() {
  const router = useRouter();
  const { enableScope, disableScope, enabledScopes } = useHotkeysContext();
  const { isCommandPaletteOpen, isNewCastModalOpen } = useNavigationStore();
  const { selectedCast } = useDataStore();
  
  // Use pathname safely with fallback
  const pathname = router?.pathname || '/';

  // Ensure global scope is always enabled on mount
  useEffect(() => {
    enableScope(HotkeyScopes.GLOBAL);
  }, [enableScope]);

  // Debug: log enabled scopes in development on client side
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.log('Enabled scopes:', enabledScopes);
    }
  }, [enabledScopes]);

  // Update scopes based on current page
  useEffect(() => {
    const scopes = getScopesForPage(pathname);

    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.log('Page scopes for', pathname, ':', scopes);
    }

    // Enable page-specific scopes
    scopes.forEach((scope) => {
      enableScope(scope);
    });

    // Cleanup function to disable page scopes when navigating away
    return () => {
      // Don't disable global scope
      scopes
        .filter((s) => s !== HotkeyScopes.GLOBAL)
        .forEach((scope) => {
          disableScope(scope);
        });
    };
  }, [pathname, enableScope, disableScope]);

  // Handle modal states
  useEffect(() => {
    if (isCommandPaletteOpen) {
      enableScope(HotkeyScopes.COMMAND_PALETTE);
      // Disable other scopes when command palette is open
      Object.values(HotkeyScopes)
        .filter((s) => s !== HotkeyScopes.COMMAND_PALETTE && s !== HotkeyScopes.GLOBAL)
        .forEach((s) => disableScope(s));
    } else {
      disableScope(HotkeyScopes.COMMAND_PALETTE);
      // Re-enable page scopes
      getScopesForPage(pathname).forEach((scope) => enableScope(scope));
      // Always ensure global scope is enabled
      enableScope(HotkeyScopes.GLOBAL);
    }
  }, [isCommandPaletteOpen, pathname, enableScope, disableScope]);

  // Handle editor modal
  useEffect(() => {
    if (isNewCastModalOpen) {
      enableScope(HotkeyScopes.EDITOR);
      enableScope(HotkeyScopes.MODAL);
    } else {
      disableScope(HotkeyScopes.EDITOR);
      disableScope(HotkeyScopes.MODAL);
    }
  }, [isNewCastModalOpen, enableScope, disableScope]);

  // Handle cast selection
  useEffect(() => {
    if (selectedCast) {
      enableScope(HotkeyScopes.CAST_SELECTED);
    } else {
      disableScope(HotkeyScopes.CAST_SELECTED);
    }
  }, [selectedCast, enableScope, disableScope]);

  return null;
}

export function AppHotkeysProvider({ children }: AppHotkeysProviderProps) {
  // Start with the global scope active
  const initialScopes = [HotkeyScopes.GLOBAL];

  return (
    <HotkeysProvider initiallyActiveScopes={initialScopes}>
      <ScopeManager />
      {children}
    </HotkeysProvider>
  );
}
