import type { DebouncedFunc } from 'lodash';
import debounce from 'lodash.debounce';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * This hook provides a function that returns whether the component is still mounted.
 * This is useful as a check before calling set state operations which will generates
 * a warning when it is called when the component is unmounted.
 * @returns a function
 */
export function useIsMounted(): () => boolean {
  const mountedRef = useRef(false);
  useEffect(function useMountedEffect() {
    mountedRef.current = true;
    return function useMountedEffectCleanup() {
      mountedRef.current = false;
    };
  }, []);
  return useCallback(
    function isMounted() {
      return mountedRef.current;
    },
    [mountedRef]
  );
}

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const updateSize = (): void => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', debounce(updateSize, 250));
    return (): void => window.removeEventListener('resize', updateSize);
  }, []);

  return isMobile;
};

/**
 * Hook that debounces a value
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that returns a debounced callback function
 * @param callback The callback function to debounce
 * @param delay The delay in milliseconds
 * @param deps The dependencies array
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const debounceRef = useRef<DebouncedFunc<T> | undefined>(undefined);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Cancel previous debounce on cleanup
    if (debounceRef.current) {
      debounceRef.current.cancel();
    }

    // Create new debounced function
    debounceRef.current = debounce(
      (...args: Parameters<T>) => {
        callbackRef.current(...args);
      },
      delay,
      {
        leading: false,
        trailing: true,
      }
    );

    // Cleanup function
    return () => {
      if (debounceRef.current) {
        debounceRef.current.cancel();
      }
    };
  }, [delay, ...deps]);

  // Return a stable reference to the debounced function
  return useCallback(
    (...args: Parameters<T>) => {
      if (debounceRef.current) {
        debounceRef.current(...args);
      }
    },
    [delay, ...deps]
  );
}
