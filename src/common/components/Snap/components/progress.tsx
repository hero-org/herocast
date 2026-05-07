'use client';

import { useSnapColors } from '../useSnapColors';

export function SnapProgress({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const value = Number(props.value ?? 0);
  const max = Number(props.max ?? 100);
  const label = props.label ? String(props.label) : undefined;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs" style={{ color: colors.textMuted }}>
          {label}
        </span>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.muted }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: colors.accent }}
        />
      </div>
    </div>
  );
}
