import React, { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHotkeys } from 'react-hotkeys-hook';

interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

const MAX_CHAR_LIMIT = 320;

export function MessageInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = 'Type a message...',
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
    if (!message.trim() || isLoading || disabled) return;

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
  }, [message, onSend, isLoading, disabled]);

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
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className={cn(
          'resize-none overflow-hidden min-h-[40px] max-h-[200px] pr-12',
          'focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        rows={1}
      />

      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {message.length > 0 && (
          <span className={cn('text-xs', isNearLimit ? 'text-destructive' : 'text-muted-foreground')}>
            {remainingChars}
          </span>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading || disabled}
          className="h-8 w-8 p-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {message.length > 0 && <div className="text-xs text-muted-foreground mt-1">Press Cmd+Enter to send</div>}
    </div>
  );
}
