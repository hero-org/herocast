'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const V_GAP = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;
const H_GAP = { none: 'gap-0', sm: 'gap-1', md: 'gap-2', lg: 'gap-3' } as const;
const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
} as const;

export function SnapStack({
  element: { props },
  children,
}: {
  element: { props: Record<string, unknown> };
  children?: ReactNode;
}) {
  const direction = String(props.direction ?? 'vertical');
  const isHorizontal = direction === 'horizontal';
  const gapMap = isHorizontal ? H_GAP : V_GAP;
  const gap = gapMap[String(props.gap ?? 'md') as keyof typeof gapMap] ?? gapMap.md;
  const justify = props.justify ? JUSTIFY[String(props.justify) as keyof typeof JUSTIFY] : undefined;

  return (
    <div className={cn('flex', isHorizontal ? 'flex-row items-center' : 'flex-col', gap, justify)}>{children}</div>
  );
}
