import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { KeyboardShortcutTooltip } from '@/components/ui/keyboard-shortcut-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_CHAR_LIMIT = 320;

export function MessageInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = 'Type a message...',
  autoFocus = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHAR_LIMIT) {
      setMessage(value);

      // Auto-resize logic
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || disabled) return;

    try {
      await onSend(message.trim());
      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [message, onSend, disabled]);

  // Removed global hotkey registration to prevent conflicts
  // The onKeyDown handler on the textarea already handles Cmd+Enter

  const remainingChars = MAX_CHAR_LIMIT - message.length;
  const isNearLimit = remainingChars < 50;

  if (disabled && !placeholder.includes('Read-only')) {
    placeholder = 'Read-only mode';
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleTextareaChange}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            // Only handle if this textarea is currently focused and message is not empty
            if (document.activeElement === e.currentTarget && message.trim() && !disabled) {
              e.preventDefault();
              e.stopPropagation(); // Prevent event from bubbling to other components
              handleSubmit();
            }
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          'resize-none overflow-hidden min-h-[40px] max-h-[200px] pr-24',
          'focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        rows={1}
      />

      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        <span
          className={cn(
            'text-[11px] font-medium tabular-nums transition-all duration-200',
            message.length > 0 ? 'opacity-70' : 'opacity-0',
            isNearLimit && 'text-destructive opacity-100'
          )}
        >
          {remainingChars}
        </span>

        <KeyboardShortcutTooltip keys="cmd+enter" disabled={!message.trim() || disabled}>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
            className={cn(
              'h-7 px-3 text-xs font-medium',
              'border-muted-foreground/20 hover:border-muted-foreground/40',
              'transition-all duration-200',
              message.trim() && !disabled && 'border-primary/50 hover:border-primary'
            )}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
          </Button>
        </KeyboardShortcutTooltip>
      </div>
    </div>
  );
}
