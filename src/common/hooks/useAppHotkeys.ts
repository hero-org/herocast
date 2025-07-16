import { useHotkeys, Options } from 'react-hotkeys-hook';
import { HotkeyScope } from '@/common/constants/hotkeys';
import { useCallback } from 'react';

interface AppHotkeyOptions extends Options {
  scopes?: HotkeyScope | HotkeyScope[];
}

// Wrapper around useHotkeys that handles common patterns
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
