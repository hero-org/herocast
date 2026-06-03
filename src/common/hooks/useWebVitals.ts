'use client';

import { useEffect } from 'react';
import { recordMetric } from '@/stores/usePerformanceStore';

/**
 * Wire web-vitals `onINP()` into the performance store as a standardized, page-level
 * INP cross-check (`inp:page`) that lives alongside the manually tagged per-flow
 * `inp:*` metrics. The attribution build is dynamically imported so it stays off the
 * critical bundle.
 */
export function useWebVitals() {
  useEffect(() => {
    let cancelled = false;
    import('web-vitals/attribution').then(({ onINP }) => {
      if (cancelled) return;
      onINP((metric) => {
        recordMetric(`inp:page`, metric.value, 200, {
          rating: metric.rating,
          interactionType: metric.attribution.interactionType,
          interactionTarget: metric.attribution.interactionTarget,
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
