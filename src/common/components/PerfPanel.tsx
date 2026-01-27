'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { getPerformanceSummary, usePerformanceStore } from '@/stores/usePerformanceStore';

type ViewMode = 'recent' | 'summary';

export const PerfPanel: React.FC = () => {
  const { metrics, clearMetrics, getSlowMetrics } = usePerformanceStore();
  const [isVisible, setIsVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('recent');

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

  const recentMetrics = metrics.slice(0, 15);
  const slowMetrics = getSlowMetrics().slice(0, 5);
  const summary = getPerformanceSummary();

  const copyToClipboard = () => {
    const data = {
      timestamp: new Date().toISOString(),
      summary,
      recentMetrics: metrics.slice(0, 50),
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/95 text-white p-4 rounded-lg text-sm font-mono z-50 max-w-md max-h-[70vh] overflow-hidden flex flex-col shadow-xl border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm">⚡ Performance Monitor</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'recent' ? 'summary' : 'recent')}
            className="text-xs text-gray-400 hover:text-white"
          >
            {viewMode === 'recent' ? 'Summary' : 'Recent'}
          </button>
          <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {viewMode === 'recent' ? (
          <>
            <div>
              <h4 className="text-xs text-gray-400 mb-1 sticky top-0 bg-black/95">Recent ({metrics.length} total)</h4>
              {recentMetrics.length === 0 ? (
                <div className="text-xs text-gray-500">No metrics yet</div>
              ) : (
                recentMetrics.map((metric, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span className="truncate flex-1 pr-2">{metric.name}</span>
                    <span
                      className={`shrink-0 ${
                        metric.status === 'good'
                          ? 'text-green-400'
                          : metric.status === 'warning'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                    >
                      {metric.duration.toFixed(0)}ms
                    </span>
                  </div>
                ))
              )}
            </div>

            {slowMetrics.length > 0 && (
              <div className="border-t border-gray-700 pt-2">
                <h4 className="text-xs text-red-400 mb-1">🐌 Slow Operations</h4>
                {slowMetrics.map((metric, i) => (
                  <div key={i} className="text-xs text-red-300 py-0.5">
                    {metric.name}: {metric.duration.toFixed(0)}ms
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <h4 className="text-xs text-gray-400 mb-2">Averages by Operation</h4>
            {Object.keys(summary).length === 0 ? (
              <div className="text-xs text-gray-500">No metrics yet</div>
            ) : (
              Object.entries(summary)
                .sort(([, a], [, b]) => b.avg - a.avg)
                .map(([name, stats]) => (
                  <div key={name} className="text-xs py-1 border-b border-gray-800">
                    <div className="flex justify-between">
                      <span className="truncate flex-1 pr-2">{name}</span>
                      <span className="text-blue-400">{stats.avg}ms avg</span>
                    </div>
                    <div className="flex gap-3 text-gray-500 text-[10px]">
                      <span>min: {stats.min}ms</span>
                      <span>max: {stats.max}ms</span>
                      <span>n={stats.count}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 pt-2 mt-2 flex gap-2 shrink-0">
        <button
          onClick={copyToClipboard}
          className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white"
        >
          Copy JSON
        </button>
        <button onClick={clearMetrics} className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
          Clear
        </button>
      </div>

      <div className="text-[10px] text-gray-500 mt-2">Ctrl+Shift+P to toggle • window.__perfSummary()</div>
    </div>
  );
};
