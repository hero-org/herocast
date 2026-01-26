import { AlertCircle, Clock, ExternalLink, Key, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { DMErrorType, getErrorInfo } from '@/common/utils/dmErrors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const RetryButton: React.FC<RetryButtonProps> = ({ onRetry, disabled = false, className, children = 'Retry' }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      variant="outline"
      size="sm"
      className={cn('min-w-[80px]', className)}
    >
      {isRetrying ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Retrying...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          {children}
        </>
      )}
    </Button>
  );
};

interface CountdownTimerProps {
  endTime: number;
  onComplete: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ endTime, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime, onComplete]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return <span className="font-mono text-sm text-muted-foreground">{formatTime(timeLeft)}</span>;
};

interface DMErrorStateProps {
  error: unknown;
  onRetry?: () => void | Promise<void>;
  className?: string;
}

export const DMErrorState: React.FC<DMErrorStateProps> = ({ error, onRetry, className }) => {
  const router = useRouter();
  const [canRetry, setCanRetry] = useState(false);
  const errorInfo = getErrorInfo(error);

  // Calculate rate limit end time (60 seconds from now as fallback)
  const getRateLimitEndTime = () => {
    return Date.now() + 60000; // 60 seconds
  };

  const handleRateLimitComplete = () => {
    setCanRetry(true);
  };

  const handleReEnterApiKey = () => {
    router.push('/settings');
  };

  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case DMErrorType.INVALID_API_KEY:
        return <Key className="h-5 w-5" />;
      case DMErrorType.RATE_LIMIT:
        return <Clock className="h-5 w-5" />;
      case DMErrorType.NETWORK:
        return <WifiOff className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getAlertVariant = () => {
    switch (errorInfo.type) {
      case DMErrorType.INVALID_API_KEY:
      case DMErrorType.NOT_FOUND:
        return 'destructive';
      default:
        return 'default';
    }
  };

  const renderErrorContent = () => {
    switch (errorInfo.type) {
      case DMErrorType.INVALID_API_KEY:
        return (
          <div className="space-y-3">
            <AlertDescription className="space-y-2">
              <p>{errorInfo.message}</p>
              <p className="text-sm text-muted-foreground">{errorInfo.action}</p>
            </AlertDescription>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleReEnterApiKey} size="sm" className="w-full sm:w-auto">
                <Key className="mr-2 h-4 w-4" />
                Update API Key
              </Button>
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" asChild>
                <a href="https://docs.farcaster.xyz/reference/warpcast/api" target="_blank" rel="noopener noreferrer">
                  Learn More
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        );

      case DMErrorType.RATE_LIMIT:
        return (
          <div className="space-y-3">
            <AlertDescription className="space-y-2">
              <p>{errorInfo.message}</p>
              <p className="text-sm text-muted-foreground">{errorInfo.action}</p>
            </AlertDescription>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Try again in:</span>
                <CountdownTimer endTime={getRateLimitEndTime()} onComplete={handleRateLimitComplete} />
              </div>
              {onRetry && <RetryButton onRetry={onRetry} disabled={!canRetry} />}
            </div>
          </div>
        );

      case DMErrorType.NETWORK:
        return (
          <div className="space-y-3">
            <AlertDescription className="space-y-2">
              <p>{errorInfo.message}</p>
              <p className="text-sm text-muted-foreground">{errorInfo.action}</p>
            </AlertDescription>
            {onRetry && (
              <div className="flex items-center gap-3">
                <RetryButton onRetry={onRetry} />
                <span className="text-xs text-muted-foreground">Check your internet connection</span>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-3">
            <AlertDescription className="space-y-2">
              <p>{errorInfo.message}</p>
              {errorInfo.action && <p className="text-sm text-muted-foreground">{errorInfo.action}</p>}
            </AlertDescription>
            <div className="flex flex-col sm:flex-row gap-2">
              {onRetry && errorInfo.canRetry && <RetryButton onRetry={onRetry} />}
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" asChild>
                <a href="https://github.com/hellno/herocast/issues/new" target="_blank" rel="noopener noreferrer">
                  Report Issue
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn('animate-in fade-in-50 duration-500', className)}>
      <Alert variant={getAlertVariant()}>
        {getErrorIcon()}
        <AlertTitle className="ml-2">
          {errorInfo.type === DMErrorType.INVALID_API_KEY && 'Authentication Required'}
          {errorInfo.type === DMErrorType.RATE_LIMIT && 'Rate Limited'}
          {errorInfo.type === DMErrorType.NETWORK && 'Connection Error'}
          {errorInfo.type === DMErrorType.NOT_FOUND && 'Not Found'}
          {errorInfo.type === DMErrorType.SERVER_ERROR && 'Server Error'}
          {errorInfo.type === DMErrorType.UNKNOWN && 'Something went wrong'}
        </AlertTitle>
        {renderErrorContent()}
      </Alert>
    </div>
  );
};

// Export the RetryButton for use in other components
export { RetryButton };
