'use client';

import type { ReactNode } from 'react';
import { Children } from 'react';
import { useSnapColors } from '../useSnapColors';

const GAP_CLASS = { none: 'gap-0', sm: 'gap-1', md: 'gap-2', lg: 'gap-3' } as const;

export function SnapItemGroup({
  element: { props },
  children,
}: {
  element: { props: Record<string, unknown> };
  children?: ReactNode;
}) {
  const colors = useSnapColors();
  const showBorder = Boolean(props.border);
  const showSeparator = Boolean(props.separator);
  const gap = GAP_CLASS[String(props.gap ?? 'none') as keyof typeof GAP_CLASS] ?? 'gap-0';
  const items = Children.toArray(children);

  return (
    <div
      className={`flex flex-col ${gap} ${showBorder ? 'rounded-lg border p-3' : ''}`}
      style={showBorder ? { borderColor: colors.border } : undefined}
    >
      {items.map((child, i) => (
        <div key={i}>
          {child}
          {showSeparator && i < items.length - 1 && (
            <div className="h-px w-full" style={{ backgroundColor: colors.border }} />
          )}
        </div>
      ))}
    </div>
  );
}
