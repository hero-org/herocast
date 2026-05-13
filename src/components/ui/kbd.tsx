import type React from 'react';
import { Fragment } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Platform-aware glyph mapping for canonical key names.
 * On non-Mac platforms the cmd/meta/command key renders as "Ctrl".
 */
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

function detectPlatform(): 'mac' | 'windows' | 'linux' {
  if (typeof window === 'undefined') return 'mac';
  const platform = window.navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
}

/**
 * Format a single canonical key name (e.g. "cmd", "shift", "k") into its
 * display glyph or label, taking the current platform into account.
 *
 * Exported for legacy helpers; new code should prefer rendering with
 * `<Kbd>` / `<KbdGroup>` and let the component do the formatting.
 */
export function formatKey(key: string, platform?: 'mac' | 'windows' | 'linux'): string {
  const currentPlatform = platform ?? detectPlatform();
  const lower = key.toLowerCase();

  if (currentPlatform !== 'mac' && (lower === 'meta' || lower === 'cmd' || lower === 'command')) {
    return 'Ctrl';
  }

  if (KEY_SYMBOLS[lower]) return KEY_SYMBOLS[lower];

  if (/^f\d+$/.test(lower)) return lower.toUpperCase();

  if (key.length === 1) return key.toUpperCase();

  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

/**
 * Parse a shortcut string into an array of keys plus a hint about whether
 * it represents a chord (keys pressed together) or a sequence (keys
 * pressed in order).
 *
 *   "cmd+k"   -> { keys: ["cmd", "k"], sequence: false }
 *   "g f"     -> { keys: ["g", "f"],   sequence: true  }
 *   "shift+R" -> { keys: ["shift", "R"], sequence: false }
 */
function parseShortcut(shortcut: string): { keys: string[]; sequence: boolean } {
  const trimmed = shortcut.trim();
  if (!trimmed) return { keys: [], sequence: false };

  if (trimmed.includes('+')) {
    return {
      keys: trimmed
        .split('+')
        .map((part) => part.trim())
        .filter(Boolean),
      sequence: false,
    };
  }

  // Whitespace-delimited sequences like "g f"
  if (/\s/.test(trimmed)) {
    return { keys: trimmed.split(/\s+/).filter(Boolean), sequence: true };
  }

  // Single key
  return { keys: [trimmed], sequence: false };
}

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium',
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        className
      )}
      {...props}
    />
  );
}

type KbdGroupBaseProps = Omit<React.ComponentProps<'kbd'>, 'children'> & {
  /** Canonical key names or single characters. Takes precedence over `shortcut`. */
  keys?: string[];
  /**
   * Shortcut string. Use `+` for chords ("cmd+k") and whitespace for
   * sequences ("g f"). Ignored when `keys` is provided.
   */
  shortcut?: string;
  /**
   * When true, render as a sequence with a `›` separator between keys.
   * When false (default), render as a chord. If a `shortcut` string is
   * provided and `sequence` is not specified, the delimiter auto-detects:
   * `+` -> chord, whitespace -> sequence.
   */
  sequence?: boolean;
  /** Optional class for individual `<Kbd>` items. */
  kbdClassName?: string;
  /** Optional render override for each key. */
  children?: React.ReactNode;
};

function KbdGroup({ className, keys, shortcut, sequence, kbdClassName, children, ...props }: KbdGroupBaseProps) {
  // If `children` is provided, behave like the previous container-only API.
  if (children !== undefined) {
    return (
      <kbd data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props}>
        {children}
      </kbd>
    );
  }

  let resolvedKeys: string[] = keys ?? [];
  let resolvedSequence = sequence ?? false;

  if (!keys && shortcut) {
    const parsed = parseShortcut(shortcut);
    resolvedKeys = parsed.keys;
    if (sequence === undefined) resolvedSequence = parsed.sequence;
  }

  if (resolvedKeys.length === 0) return null;

  const platform = detectPlatform();

  return (
    <kbd data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props}>
      {resolvedKeys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {resolvedSequence && index > 0 && (
            <span aria-hidden="true" className="text-muted-foreground/60 text-xs leading-none">
              {'›'}
            </span>
          )}
          <Kbd className={kbdClassName}>{formatKey(key, platform)}</Kbd>
        </Fragment>
      ))}
    </kbd>
  );
}

export interface KbdTooltipProps {
  children: React.ReactNode;
  /** Canonical key names or single characters. Takes precedence over `shortcut`. */
  keys?: string[];
  /** Shortcut string ("cmd+k" for chord, "g f" for sequence). */
  shortcut?: string;
  /** Force chord vs sequence rendering. Auto-detected from `shortcut` if omitted. */
  sequence?: boolean;
  /** Optional description rendered before the shortcut keys. */
  description?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  className?: string;
  contentClassName?: string;
  kbdClassName?: string;
  /** When true, the tooltip is suppressed and `children` is rendered directly. */
  disabled?: boolean;
}

/**
 * Wraps a child element in a tooltip that shows a keyboard shortcut hint.
 * Replaces the legacy `KeyboardShortcutTooltip`.
 */
function KbdTooltip({
  children,
  keys,
  shortcut,
  sequence,
  description,
  side = 'top',
  align = 'center',
  delayDuration = 400,
  className,
  contentClassName,
  kbdClassName,
  disabled = false,
}: KbdTooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className={cn('flex items-center gap-3 px-3 py-2', contentClassName)}>
          {description && <span className="text-sm font-medium">{description}</span>}
          <KbdGroup
            keys={keys}
            shortcut={shortcut}
            sequence={sequence}
            kbdClassName={kbdClassName}
            className="ml-auto"
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Kbd, KbdGroup, KbdTooltip };
