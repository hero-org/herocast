import { AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MessageStatusProps {
  status?: 'pending' | 'sent' | 'failed';
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export function MessageStatus({ status, error, onRetry, className }: MessageStatusProps) {
  if (!status || status === 'sent') {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {status === 'pending' && (
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          <Clock className="h-3 w-3 mr-1" />
          Sending...
        </Badge>
      )}

      {status === 'failed' && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs px-2 py-0.5">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
          {onRetry && (
            <button onClick={onRetry} className="text-xs text-primary hover:underline flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
          {error && (
            <span className="text-xs text-muted-foreground" title={error}>
              ({error})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
