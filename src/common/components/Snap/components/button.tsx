'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSnapColors } from '../useSnapColors';
import { ICON_MAP } from './icon';

export function SnapButton({
  element,
  emit,
}: {
  element: { props: Record<string, unknown>; on?: Record<string, unknown> };
  emit: (action: string) => void;
}) {
  const { props } = element;
  const label = String(props.label ?? 'Action');
  const isPrimary = String(props.variant ?? 'secondary') === 'primary';
  const iconName = props.icon ? String(props.icon) : undefined;
  const colors = useSnapColors();
  const [hovered, setHovered] = useState(false);

  const Icon = iconName ? ICON_MAP[iconName] : undefined;
  const showExternal =
    element.on && typeof element.on === 'object' && 'press' in element.on
      ? (element.on.press as Record<string, unknown>)?.action === 'open_url'
      : false;

  const style = isPrimary
    ? {
        backgroundColor: hovered ? colors.accentHover : colors.accent,
        color: colors.accentFg,
        borderColor: 'transparent',
      }
    : {
        backgroundColor: hovered ? `color-mix(in srgb, ${colors.accent} 15%, transparent)` : colors.muted,
        color: colors.text,
        borderColor: 'transparent',
      };

  return (
    <div className="w-full min-w-0 flex-1">
      <Button
        type="button"
        variant={isPrimary ? 'default' : 'secondary'}
        className="w-full gap-2"
        style={style}
        onClick={() => emit('press')}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {Icon && <Icon size={16} />}
        {label}
        {showExternal && <ExternalLink size={14} style={{ opacity: 0.6 }} />}
      </Button>
    </div>
  );
}
