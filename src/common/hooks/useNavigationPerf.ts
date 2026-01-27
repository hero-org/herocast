'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { endTiming, startTiming } from '@/stores/usePerformanceStore';

/**
 * Hook to track page navigation performance
 * Measures time from route change start to completion
 */
export function useNavigationPerf() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const timingIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip initial mount
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      return;
    }

    // Path changed - end previous timing if exists and start new one
    if (prevPathRef.current !== pathname) {
      if (timingIdRef.current) {
        endTiming(timingIdRef.current, 300, {
          from: prevPathRef.current,
          to: pathname,
        });
      }

      // Start timing for this navigation
      timingIdRef.current = startTiming(`nav:${pathname}`);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  // End timing after render completes
  useEffect(() => {
    if (timingIdRef.current) {
      // Use requestAnimationFrame to measure after paint
      requestAnimationFrame(() => {
        if (timingIdRef.current) {
          endTiming(timingIdRef.current, 300, { route: pathname });
          timingIdRef.current = null;
        }
      });
    }
  }, [pathname]);
}
