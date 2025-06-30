import * as React from 'react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutDisplayProps extends React.HTMLAttributes<HTMLElement> {
  shortcut: string;
  size?: 'sm' | 'md' | 'lg';
}

// Common modifier keys that should be displayed with symbols
const MODIFIER_KEYS = ['meta', 'cmd', 'command', 'ctrl', 'control', 'shift', 'alt', 'option'];

// Key display mappings
const KEY_DISPLAY: Record<string, string> = {
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  enter: '↵',
  return: '↵',
  escape: 'Esc',
  esc: 'Esc',
  delete: 'Del',
  backspace: '⌫',
  tab: 'Tab',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  '/': '/',
  ',': ',',
  '.': '.',
};

const SIZE_CLASSES = {
  sm: 'gap-0.5 text-[11px]',
  md: 'gap-1 text-xs',
  lg: 'gap-1.5 text-sm',
};

function formatKeyPart(key: string): string {
  const lowerKey = key.toLowerCase();

  // Check if we have a display mapping
  if (KEY_DISPLAY[lowerKey]) {
    return KEY_DISPLAY[lowerKey];
  }

  // For single letters, uppercase them
  if (key.length === 1) {
    return key.toUpperCase();
  }

  // For function keys
  if (lowerKey.startsWith('f') && /^f\d+$/.test(lowerKey)) {
    return key.toUpperCase();
  }

  // Default: capitalize first letter
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

export function KeyboardShortcutDisplay({ shortcut, size = 'sm', className, ...props }: KeyboardShortcutDisplayProps) {
  // Parse the shortcut string
  const parts = shortcut.split('+').map((part) => part.trim());

  // Group modifiers and main keys
  const modifiers: string[] = [];
  const mainKeys: string[] = [];

  parts.forEach((part) => {
    if (MODIFIER_KEYS.includes(part.toLowerCase())) {
      modifiers.push(part);
    } else {
      mainKeys.push(part);
    }
  });

  // Combine for display
  const allKeys = [...modifiers, ...mainKeys];

  return (
    <span className={cn('inline-flex items-center font-mono', SIZE_CLASSES[size], className)} {...props}>
      {allKeys.map((key, index) => {
        const displayKey = formatKeyPart(key);
        const isModifier = modifiers.includes(key);

        return (
          <kbd
            key={index}
            className={cn(
              'inline-flex items-center justify-center rounded px-1',
              'bg-muted text-muted-foreground border border-border',
              'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
              size === 'sm' && 'h-5 min-w-[20px]',
              size === 'md' && 'h-6 min-w-[24px]',
              size === 'lg' && 'h-7 min-w-[28px]',
              isModifier && 'font-normal',
              !isModifier && 'font-semibold'
            )}
          >
            {displayKey}
          </kbd>
        );
      })}
    </span>
  );
}
