import * as React from 'react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutProps extends React.HTMLAttributes<HTMLElement> {
  keys: string | string[];
  size?: 'sm' | 'md' | 'lg';
}

const KEY_SYMBOLS: Record<string, string> = {
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  delete: '⌫',
  backspace: '⌫',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: '⇞',
  pagedown: '⇟',
  home: '⇱',
  end: '⇲',
};

const SIZE_CLASSES = {
  sm: 'h-5 min-w-[20px] px-1 text-[10px]',
  md: 'h-6 min-w-[24px] px-1.5 text-xs',
  lg: 'h-7 min-w-[28px] px-2 text-sm',
};

function detectPlatform(): 'mac' | 'windows' | 'linux' {
  if (typeof window === 'undefined') return 'mac';

  const platform = window.navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
}

export function formatKey(key: string, platform?: 'mac' | 'windows' | 'linux'): string {
  const currentPlatform = platform || detectPlatform();
  const lowercaseKey = key.toLowerCase();

  // Handle platform-specific mappings
  if (currentPlatform !== 'mac') {
    if (lowercaseKey === 'meta' || lowercaseKey === 'cmd' || lowercaseKey === 'command') {
      return 'Ctrl';
    }
  }

  // Return symbol if available
  if (KEY_SYMBOLS[lowercaseKey]) {
    return KEY_SYMBOLS[lowercaseKey];
  }

  // Handle function keys
  if (lowercaseKey.match(/^f\d+$/)) {
    return lowercaseKey.toUpperCase();
  }

  // Default: capitalize first letter
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

export function KeyboardShortcut({ keys, size = 'md', className, ...props }: KeyboardShortcutProps) {
  const platform = detectPlatform();

  // Defensive check - return null if keys is undefined or empty
  if (!keys || (Array.isArray(keys) && keys.length === 0)) {
    return null;
  }

  const keyArray = Array.isArray(keys) ? keys : keys.split('+').map((k) => k.trim());

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded border font-mono font-medium',
        'bg-muted text-muted-foreground',
        'border-border',
        'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {keyArray.map((key, index) => {
        const formattedKey = formatKey(key, platform);
        const isModifier = ['⌘', '⌃', '⇧', '⌥', 'Ctrl', 'Shift', 'Alt'].includes(formattedKey);
        const prevKey = index > 0 ? formatKey(keyArray[index - 1], platform) : null;
        const isPrevModifier = prevKey ? ['⌘', '⌃', '⇧', '⌥', 'Ctrl', 'Shift', 'Alt'].includes(prevKey) : false;

        return (
          <React.Fragment key={index}>
            {index > 0 && isPrevModifier && !isModifier && <span className="mx-0.5 opacity-40 text-[10px]">+</span>}
            <span className={cn(isModifier && 'text-xs', !isModifier && 'text-sm font-semibold')}>{formattedKey}</span>
          </React.Fragment>
        );
      })}
    </kbd>
  );
}

// Compound component for more complex layouts
export function KeyboardShortcutGroup({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)} {...props}>
      {children}
    </div>
  );
}

// Example usage:
// <KeyboardShortcut keys="meta+k" />
// <KeyboardShortcut keys={["ctrl", "shift", "p"]} size="lg" />
// <KeyboardShortcutGroup>
//   <KeyboardShortcut keys="meta" size="sm" />
//   <span className="text-muted-foreground">then</span>
//   <KeyboardShortcut keys="k" size="sm" />
// </KeyboardShortcutGroup>
