'use client';

import { useStateStore } from '@json-render/react';
import { Switch } from '@/components/ui/switch';
import { useSnapColors } from '../useSnapColors';

export function SnapSwitch({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const { get, set } = useStateStore();
  const colors = useSnapColors();
  const name = String(props.name ?? '');
  const path = `/inputs/${name}`;
  const checked = (get(path) as boolean) ?? Boolean(props.defaultChecked);

  return (
    <div className="flex items-center justify-between gap-3">
      {props.label ? (
        <label className="text-sm" style={{ color: colors.text }}>
          {String(props.label)}
        </label>
      ) : null}
      <Switch checked={checked} onCheckedChange={(v) => set(path, v)} />
    </div>
  );
}
