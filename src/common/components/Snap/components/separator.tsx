'use client';

import { Separator } from '@/components/ui/separator';
import { useSnapColors } from '../useSnapColors';

export function SnapSeparator({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const orientation = String(props.orientation ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  return <Separator orientation={orientation} style={{ backgroundColor: colors.border }} />;
}
