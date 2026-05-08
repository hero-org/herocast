'use client';

import type { ReactNode } from 'react';
import { useSnapColors } from '../useSnapColors';

export function SnapItem({
  element: { props },
  children,
}: {
  element: { props: Record<string, unknown> };
  children?: ReactNode;
}) {
  const colors = useSnapColors();
  const title = String(props.title ?? '');
  const description = props.description ? String(props.description) : undefined;

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
          {title}
        </p>
        {description && (
          <p className="text-xs truncate" style={{ color: colors.textMuted }}>
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-1.5 flex-shrink-0">{children}</div>}
    </div>
  );
}
