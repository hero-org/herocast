import posthog from 'posthog-js';
import { create } from 'zustand';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

interface PerformanceStore {
  metrics: PerformanceMetric[];
  addMetric: (metric: PerformanceMetric) => void;
  clearMetrics: () => void;
  getMetricsByName: (name: string) => PerformanceMetric[];
  getAverageByName: (name: string) => number | null;
  getSlowMetrics: () => PerformanceMetric[];
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  metrics: [],
  addMetric: (metric: PerformanceMetric) =>
    set((state) => ({
      metrics: [metric, ...state.metrics.slice(0, 99)], // Keep last 100
    })),
  clearMetrics: () => set({ metrics: [] }),
  getMetricsByName: (name: string) => get().metrics.filter((m) => m.name === name),
  getAverageByName: (name: string) => {
    const filtered = get().metrics.filter((m) => m.name === name);
    if (filtered.length === 0) return null;
    return filtered.reduce((sum, m) => sum + m.duration, 0) / filtered.length;
  },
  getSlowMetrics: () => get().metrics.filter((m) => m.status === 'critical'),
}));

// Track active timings to prevent orphaned marks
const activeTimings = new Map<string, number>();

/**
 * Start a performance timing measurement
 * @param name - Unique identifier for this measurement
 * @returns The timing ID to pass to endTiming
 */
export const startTiming = (name: string): string => {
  const id = `${name}-${Date.now()}`;
  activeTimings.set(id, performance.now());
  performance.mark(`${id}-start`);
  return id;
};

/**
 * End a performance timing measurement and record the metric
 * @param timingId - The ID returned from startTiming
 * @param threshold - Target duration in ms (default 100). Duration > threshold = warning, > 2x = critical
 * @param metadata - Optional metadata to attach to the metric
 * @returns The duration in milliseconds
 */
export const endTiming = (timingId: string, threshold = 100, metadata?: Record<string, unknown>): number => {
  const startTime = activeTimings.get(timingId);
  if (startTime === undefined) {
    console.warn(`[Perf] No start timing found for: ${timingId}`);
    return 0;
  }

  activeTimings.delete(timingId);
  performance.mark(`${timingId}-end`);

  try {
    performance.measure(timingId, `${timingId}-start`, `${timingId}-end`);
  } catch {
    // Fallback if marks don't exist
    const duration = performance.now() - startTime;
    return recordMetric(timingId, duration, threshold, metadata);
  }

  const measure = performance.getEntriesByName(timingId, 'measure')[0];
  const duration = measure?.duration ?? performance.now() - startTime;

  // Clean up performance entries
  performance.clearMarks(`${timingId}-start`);
  performance.clearMarks(`${timingId}-end`);
  performance.clearMeasures(timingId);

  return recordMetric(timingId, duration, threshold, metadata);
};

/**
 * Record a metric directly (for when you already have the duration)
 */
export const recordMetric = (
  name: string,
  duration: number,
  threshold = 100,
  metadata?: Record<string, unknown>
): number => {
  // Extract the base name (remove timestamp suffix if present)
  const baseName = name.replace(/-\d+$/, '');

  const metric: PerformanceMetric = {
    name: baseName,
    duration,
    timestamp: Date.now(),
    threshold,
    status: duration < threshold ? 'good' : duration < threshold * 2 ? 'warning' : 'critical',
    metadata,
  };

  // Add to global store
  usePerformanceStore.getState().addMetric(metric);

  // Send to PostHog for production observability (only critical/warning to avoid noise)
  if (typeof window !== 'undefined' && (metric.status === 'critical' || metric.status === 'warning')) {
    try {
      posthog.capture('performance_metric', {
        metric_name: baseName,
        duration_ms: Math.round(duration),
        threshold_ms: threshold,
        status: metric.status,
        ...metadata,
      });
    } catch {
      // PostHog might not be initialized
    }
  }

  // Dev mode logging
  if (process.env.NODE_ENV === 'development') {
    const icon = metric.status === 'good' ? '⚡' : metric.status === 'warning' ? '⚠️' : '🐌';
    const color =
      metric.status === 'good' ? 'color: green' : metric.status === 'warning' ? 'color: orange' : 'color: red';
    console.log(
      `%c${icon} [Perf] ${baseName}: ${duration.toFixed(1)}ms (threshold: ${threshold}ms)`,
      color,
      metadata || ''
    );
  }

  return duration;
};

/**
 * Measure an async function's execution time
 * @param name - Name for the measurement
 * @param fn - Async function to measure
 * @param threshold - Target duration in ms
 * @returns The result of the function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  threshold = 100,
  metadata?: Record<string, unknown>
): Promise<T> {
  const timingId = startTiming(name);
  try {
    const result = await fn();
    endTiming(timingId, threshold, metadata);
    return result;
  } catch (error) {
    endTiming(timingId, threshold, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Measure a sync function's execution time
 * @param name - Name for the measurement
 * @param fn - Function to measure
 * @param threshold - Target duration in ms
 * @returns The result of the function
 */
export function measureSync<T>(name: string, fn: () => T, threshold = 100, metadata?: Record<string, unknown>): T {
  const timingId = startTiming(name);
  try {
    const result = fn();
    endTiming(timingId, threshold, metadata);
    return result;
  } catch (error) {
    endTiming(timingId, threshold, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Get performance summary for debugging
 */
export const getPerformanceSummary = () => {
  const store = usePerformanceStore.getState();
  const metrics = store.metrics;

  const byName = new Map<string, number[]>();
  for (const m of metrics) {
    const existing = byName.get(m.name) || [];
    existing.push(m.duration);
    byName.set(m.name, existing);
  }

  const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};
  for (const [name, durations] of byName) {
    summary[name] = {
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      min: Math.round(Math.min(...durations)),
      max: Math.round(Math.max(...durations)),
      count: durations.length,
    };
  }

  return summary;
};

// Export for use in dev tools
if (typeof window !== 'undefined') {
  (window as unknown as { __perfSummary: typeof getPerformanceSummary }).__perfSummary = getPerformanceSummary;
}
