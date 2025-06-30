import * as React from 'react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutSingleProps extends React.HTMLAttributes<HTMLElement> {
  shortcut: string;
  size?: 'sm' | 'md' | 'lg';
}

// Platform detection
function detectPlatform(): 'mac' | 'windows' | 'linux' {
  if (typeof window === 'undefined') return 'mac';
  const platform = window.navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
}

// Key display mappings with better readability
const KEY_DISPLAY: Record<string, string> = {
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Option',
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  delete: 'Del',
  backspace: 'Backspace',
  tab: 'Tab',
  space: 'Space',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  '/': '/',
  ',': ',',
  '.': '.',
};

const SIZE_CLASSES = {
  sm: 'h-6 px-2 text-xs gap-1',
  md: 'h-7 px-2.5 text-sm gap-1',
  lg: 'h-9 px-3 text-[16px] gap-1.5',
};

function formatKeyPart(key: string, platform: 'mac' | 'windows' | 'linux'): string {
  const lowerKey = key.toLowerCase();

  // Handle platform-specific mappings
  if (platform !== 'mac' && (lowerKey === 'meta' || lowerKey === 'cmd' || lowerKey === 'command')) {
    return 'Ctrl';
  }

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

const MODIFIER_KEYS = ['meta', 'cmd', 'command', 'ctrl', 'control', 'shift', 'alt', 'option'];

export function KeyboardShortcutSingle({ shortcut, size = 'sm', className, ...props }: KeyboardShortcutSingleProps) {
  const platform = detectPlatform();
  const parts = shortcut.split('+').map((part) => part.trim());

  // Separate modifiers and main keys
  const modifiers: string[] = [];
  const mainKeys: string[] = [];

  parts.forEach((part) => {
    if (MODIFIER_KEYS.includes(part.toLowerCase())) {
      modifiers.push(part);
    } else {
      mainKeys.push(part);
    }
  });

  // Combine for display - modifiers first, then main keys
  const displayParts = [...modifiers, ...mainKeys];

  // For single-letter shortcuts, show them like in the command palette
  const isSingleLetter = displayParts.length === 1 && displayParts[0].length === 1;
  
  if (isSingleLetter) {
    return (
      <kbd
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold select-none',
          'bg-muted text-foreground',
          size === 'lg' ? 'h-9 w-9 text-[16px]' : size === 'md' ? 'h-7 w-7 text-sm' : 'h-6 w-6 text-xs',
          className
        )}
        {...props}
      >
        {displayParts[0].toUpperCase()}
      </kbd>
    );
  }

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium select-none',
        'bg-muted text-foreground',
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {displayParts.map((part, index) => {
        const formatted = formatKeyPart(part, platform);
        const isModifier = modifiers.includes(part);

        return (
          <React.Fragment key={index}>
            <span className={cn('font-semibold', index > 0 && 'ml-1')}>{formatted}</span>
          </React.Fragment>
        );
      })}
    </kbd>
  );
}
