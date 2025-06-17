import { useState, useCallback } from 'react';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

export const usePerformanceTracker = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  const startTiming = useCallback((name: string) => {
    performance.mark(`${name}-start`);
    return name;
  }, []);

  const endTiming = useCallback((name: string, threshold = 100) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure.duration;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      threshold,
      status: duration < threshold ? 'good' : duration < threshold * 2 ? 'warning' : 'critical',
    };

    setMetrics((prev) => [metric, ...prev.slice(0, 49)]); // Keep last 50

    // Dev mode logging for critical slowdowns
    if (process.env.NODE_ENV === 'development' && metric.status === 'critical') {
      console.warn(`🐌 SLOW: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }

    return duration;
  }, []);

  return { metrics, startTiming, endTiming };
};

export type { PerformanceMetric };