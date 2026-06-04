'use client';

/**
 * SidebarFeedSection — a collapsible group header (Channels / Lists) plus its
 * body in the left-sidebar "feeds disclosure". Ported from the approved `lab/`
 * Disclosure variant (`GroupHeader`): a rotating chevron, an uppercase label,
 * and an optional dimmed count. Pure presentation — open/close state is owned
 * by the caller.
 */

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';

export function SidebarFeedSection({
  label,
  count,
  open,
  onToggle,
  footer,
  children,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-x-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/70"
      >
        <ChevronDown className={cn('h-3 w-3 flex-none transition-transform duration-150', !open && '-rotate-90')} />
        <span>{label}</span>
        {count !== undefined && <span className="text-sidebar-foreground/30">{count}</span>}
      </button>
      {open && (
        <>
          {children}
          {footer}
        </>
      )}
    </>
  );
}
