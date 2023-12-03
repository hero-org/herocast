import { useCallback, useEffect, useRef } from "react";

// export function useIsMounted(): () => boolean {
//   const isMountedRef = useRef(true);
//   const isMounted = useCallback(() => isMountedRef.current, []);

//   useEffect(() => {
//     isMountedRef.current = true;
//     return () => void (isMountedRef.current = false);
//   }, []);

//   return isMounted;
// }

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
  return useCallback(function isMounted() {
    return mountedRef.current;
  }, [mountedRef]);
}
