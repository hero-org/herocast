'use client';

import { useSnapColors } from '../useSnapColors';
import { ICON_MAP } from './icon';

export function SnapBadge({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const label = String(props.label ?? '');
  const isOutline = String(props.variant ?? 'default') === 'outline';
  const colorHex = colors.colorHex(props.color as string | undefined);
  const iconName = props.icon ? String(props.icon) : undefined;
  const Icon = iconName ? ICON_MAP[iconName] : undefined;

  const style = isOutline
    ? { color: colorHex, borderColor: colorHex, backgroundColor: 'transparent' }
    : { color: colorHex, backgroundColor: `${colorHex}20`, borderColor: 'transparent' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={style}
    >
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
}
