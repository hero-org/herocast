'use client';

import { useSnapColors } from '../useSnapColors';

type Bar = { label: string; value: number; color?: string };

export function SnapBarChart({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const bars = (props.bars as Bar[]) ?? [];
  const chartMax = props.max != null ? Number(props.max) : Math.max(...bars.map((b) => b.value), 1);
  const defaultColor = props.color ? String(props.color) : undefined;

  return (
    <div className="flex flex-col gap-2">
      {bars.map((bar, i) => {
        const pct = chartMax > 0 ? Math.min(100, (bar.value / chartMax) * 100) : 0;
        const barColor = colors.colorHex(bar.color ?? defaultColor);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-24 text-right text-xs truncate" style={{ color: colors.textMuted }}>
              {bar.label}
            </span>
            <div className="flex-1 h-5 overflow-hidden rounded" style={{ backgroundColor: colors.muted }}>
              <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            <span className="w-10 text-right text-xs tabular-nums" style={{ color: colors.textMuted }}>
              {bar.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
