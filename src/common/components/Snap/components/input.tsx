'use client';

import { useStateStore } from '@json-render/react';
import { Input } from '@/components/ui/input';
import { useSnapColors } from '../useSnapColors';

export function SnapInput({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const { get, set } = useStateStore();
  const colors = useSnapColors();
  const name = String(props.name ?? '');
  const path = `/inputs/${name}`;
  const value = (get(path) as string) ?? (props.defaultValue as string) ?? '';
  const type = String(props.type ?? 'text') === 'number' ? 'number' : 'text';

  return (
    <div className="flex flex-col gap-1.5">
      {props.label ? (
        <label className="text-sm font-medium" style={{ color: colors.text }}>
          {String(props.label)}
        </label>
      ) : null}
      <Input
        type={type}
        value={value}
        placeholder={props.placeholder ? String(props.placeholder) : undefined}
        maxLength={props.maxLength ? Number(props.maxLength) : undefined}
        onChange={(e) => set(path, e.target.value)}
        style={{ color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}
      />
    </div>
  );
}
