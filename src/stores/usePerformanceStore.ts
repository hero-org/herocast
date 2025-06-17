import { create } from 'zustand';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

interface PerformanceStore {
  metrics: PerformanceMetric[];
  addMetric: (metric: PerformanceMetric) => void;
  clearMetrics: () => void;
}

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  metrics: [],
  addMetric: (metric: PerformanceMetric) =>
    set((state) => ({
      metrics: [metric, ...state.metrics.slice(0, 49)], // Keep last 50
    })),
  clearMetrics: () => set({ metrics: [] }),
}));

// Global performance tracking utilities
export const startTiming = (name: string): string => {
  performance.mark(`${name}-start`);
  return name;
};

export const endTiming = (name: string, threshold = 100): number => {
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

  // Add to global store
  usePerformanceStore.getState().addMetric(metric);

  // Dev mode logging for slowdowns
  if (process.env.NODE_ENV === 'development') {
    if (metric.status === 'critical') {
      console.warn(`🐌 SLOW: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    } else if (metric.status === 'good' && duration > 0) {
      console.log(`⚡ FAST: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }
  }

  return duration;
};
