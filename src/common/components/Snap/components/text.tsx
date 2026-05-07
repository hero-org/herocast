'use client';

import { useSnapColors } from '../useSnapColors';

const SIZE_CLASS = { sm: 'text-sm', md: 'text-base' } as const;
const WEIGHT_CLASS = { bold: 'font-bold', normal: 'font-normal' } as const;
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

export function SnapText({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const colors = useSnapColors();
  const content = String(props.content ?? '');
  const size = SIZE_CLASS[String(props.size ?? 'md') as keyof typeof SIZE_CLASS] ?? 'text-base';
  const weight = WEIGHT_CLASS[String(props.weight ?? 'normal') as keyof typeof WEIGHT_CLASS] ?? 'font-normal';
  const align = ALIGN_CLASS[String(props.align ?? 'left') as keyof typeof ALIGN_CLASS] ?? 'text-left';

  return (
    <p className={`${size} ${weight} ${align} break-words`} style={{ color: colors.text }}>
      {content}
    </p>
  );
}
