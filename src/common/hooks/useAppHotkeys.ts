import { useHotkeys, Options } from 'react-hotkeys-hook';
import { HotkeyScope } from '@/common/constants/hotkeys';
import { useCallback } from 'react';

interface AppHotkeyOptions extends Options {
  scopes?: HotkeyScope | HotkeyScope[];
}

/**
 * useAppHotkeys - Wrapper around useHotkeys that handles common patterns
 *
 * USAGE GUIDELINES:
 *
 * 1. COMPONENT REQUIREMENTS:
 *    - Must be used within a component marked with 'use client' directive
 *    - Component must be inside the HotkeysProvider (from AppHotkeysProvider)
 *    - For Next.js App Router: ensure the provider tree order is correct
 *
 * 2. WHERE NOT TO USE:
 *    - In context providers that render BEFORE HotkeysProvider (e.g., SidebarProvider)
 *    - In providers at the root of the app tree
 *    - For these cases, use native addEventListener in a useEffect instead:
 *
 *    ```tsx
 *    React.useEffect(() => {
 *      const handleKeyDown = (event: KeyboardEvent) => {
 *        if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
 *          event.preventDefault();
 *          yourAction();
 *        }
 *      };
 *      window.addEventListener('keydown', handleKeyDown);
 *      return () => window.removeEventListener('keydown', handleKeyDown);
 *    }, [yourAction]);
 *    ```
 *
 * 3. BEST PRACTICES:
 *    - Always specify scopes to avoid conflicts
 *    - Use enableOnFormTags: false for single-key shortcuts (prevents firing while typing)
 *    - Use enableOnContentEditable: true only for shortcuts that should work in editors
 *    - Document shortcuts in hotkeyDefinitions.ts for consistency
 *
 * 4. SSR CONSIDERATIONS:
 *    - The hook is SSR-safe due to 'use client' boundaries
 *    - No need for typeof window checks within the hook itself
 */
export function useAppHotkeys(keys: string | string[], callback: () => void, options?: AppHotkeyOptions, deps?: any[]) {
  // Normalize keys to array
  const keyArray = Array.isArray(keys) ? keys : [keys];

  // Keep the original keys - react-hotkeys-hook handles platform differences
  const normalizedKeys = keyArray;

  // Join keys for react-hotkeys-hook
  const keyString = normalizedKeys.join(',');

  // Normalize scopes
  const scopes = options?.scopes ? (Array.isArray(options.scopes) ? options.scopes : [options.scopes]) : undefined;

  // Create stable callback - ensure we include all dependencies
  const stableCallback = useCallback(callback, deps || [callback]);

  return useHotkeys(keyString, stableCallback, {
    ...options,
    scopes: scopes || ['global'], // Default to global scope
  });
}

// Hook for registering multiple hotkeys at once
export function useMultipleHotkeys(
  hotkeys: Array<{
    keys: string | string[];
    callback: () => void;
    options?: AppHotkeyOptions;
  }>,
  deps?: any[]
) {
  // IMPORTANT: We must call hooks in a consistent order
  // Create stable references for all hotkeys
  hotkeys.forEach(({ keys, callback, options }, index) => {
    useAppHotkeys(keys, callback, options, deps);
  });
}
