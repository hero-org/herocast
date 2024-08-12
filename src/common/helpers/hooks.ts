import { useLayoutEffect, useState, useCallback, useEffect, useRef } from "react";
import debounce from "lodash/debounce";

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
        window.addEventListener("resize", debounce(updateSize, 250));
        return (): void => window.removeEventListener("resize", updateSize);
    }, []);

    return isMobile;
};
