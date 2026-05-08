'use client';

import { useStateStore } from '@json-render/react';
import { cn } from '@/lib/utils';
import { useSnapColors } from '../useSnapColors';

export function SnapToggleGroup({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const { get, set } = useStateStore();
  const colors = useSnapColors();
  const name = String(props.name ?? '');
  const path = `/inputs/${name}`;
  const options = (props.options as string[]) ?? [];
  const isMultiple = Boolean(props.multiple);
  const orientation = String(props.orientation ?? 'horizontal');
  const isVertical = orientation === 'vertical';

  const raw = get(path);
  const selected: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const defaults = props.defaultValue;
  const effectiveSelected =
    selected.length > 0
      ? selected
      : Array.isArray(defaults)
        ? defaults
        : typeof defaults === 'string'
          ? [defaults]
          : [];

  const toggle = (option: string) => {
    if (isMultiple) {
      const next = effectiveSelected.includes(option)
        ? effectiveSelected.filter((o) => o !== option)
        : [...effectiveSelected, option];
      set(path, next);
    } else {
      set(path, option);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {props.label ? (
        <label className="text-sm font-medium" style={{ color: colors.text }}>
          {String(props.label)}
        </label>
      ) : null}
      <div className={cn('flex gap-1.5', isVertical ? 'flex-col' : 'flex-row flex-wrap')}>
        {options.map((option) => {
          const isSelected = effectiveSelected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={cn('rounded-md border px-3 py-1.5 text-sm transition-colors', isSelected ? 'font-medium' : '')}
              style={{
                backgroundColor: isSelected ? `${colors.accent}20` : colors.muted,
                borderColor: isSelected ? colors.accent : 'transparent',
                color: isSelected ? colors.accent : colors.text,
              }}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
