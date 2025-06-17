import React, { useState, useEffect } from 'react';
import { usePerformanceTracker } from '../hooks/usePerformanceTracker';

export const PerfPanel: React.FC = () => {
  const { metrics } = usePerformanceTracker();
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  // Toggle with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible) return null;

  const recentMetrics = metrics.slice(0, 10);
  const slowMetrics = metrics.filter((m) => m.status === 'critical').slice(0, 5);

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-sm font-mono z-50 max-w-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">⚡ Performance Monitor</h3>
        <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white">
          ×
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <h4 className="text-xs text-gray-400 mb-1">Recent Metrics</h4>
          {recentMetrics.map((metric, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="truncate flex-1">{metric.name}</span>
              <span
                className={`ml-2 ${
                  metric.status === 'good'
                    ? 'text-green-400'
                    : metric.status === 'warning'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {metric.duration.toFixed(1)}ms
              </span>
            </div>
          ))}
        </div>

        {slowMetrics.length > 0 && (
          <div className="border-t border-gray-700 pt-2">
            <h4 className="text-xs text-red-400 mb-1">🐌 Slow Operations</h4>
            {slowMetrics.map((metric, i) => (
              <div key={i} className="text-xs text-red-300">
                {metric.name}: {metric.duration.toFixed(1)}ms
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-2">Press Ctrl+Shift+P to toggle</div>
    </div>
  );
};
