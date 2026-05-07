'use client';

import { useStateStore } from '@json-render/react';
import { useSnapColors } from '../useSnapColors';

export function SnapSlider({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const { get, set } = useStateStore();
  const colors = useSnapColors();
  const name = String(props.name ?? '');
  const path = `/inputs/${name}`;
  const min = Number(props.min ?? 0);
  const max = Number(props.max ?? 100);
  const step = Number(props.step ?? 1);
  const showValue = Boolean(props.showValue);
  const defaultValue = props.defaultValue != null ? Number(props.defaultValue) : Math.round((min + max) / 2);
  const value = (get(path) as number) ?? defaultValue;

  return (
    <div className="flex flex-col gap-1.5">
      {props.label || showValue ? (
        <div className="flex items-center justify-between">
          {props.label ? (
            <label className="text-sm" style={{ color: colors.text }}>
              {String(props.label)}
            </label>
          ) : null}
          {showValue ? (
            <span className="text-sm tabular-nums" style={{ color: colors.textMuted }}>
              {value}
            </span>
          ) : null}
        </div>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(path, Number(e.target.value))}
        className="w-full"
        style={{ accentColor: colors.accent }}
      />
    </div>
  );
}
