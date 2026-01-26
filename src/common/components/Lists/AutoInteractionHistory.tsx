import { ArrowPathIcon, ExclamationCircleIcon, HeartIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { createClient } from '@/common/helpers/supabase/component';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryItem {
  cast_hash: string;
  action: 'like' | 'recast';
  processed_at: string;
  status?: 'success' | 'failed';
  error_message?: string;
}

interface AutoInteractionHistoryProps {
  listId: string;
}

export function AutoInteractionHistory({ listId }: AutoInteractionHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchHistory();
  }, [listId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('auto_interaction_history')
        .select('*')
        .eq('list_id', listId)
        .order('processed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Interaction history is temporarily unavailable.
        <br />
        <span className="text-sm">This feature will be enabled once database migrations are complete.</span>
      </div>
    );
  }

  const successCount = history.filter((h) => h.status === 'success').length;
  const failureCount = history.filter((h) => h.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="font-medium">{successCount}</span>
          <span className="text-muted-foreground">successful</span>
        </div>
        {failureCount > 0 && (
          <div className="flex items-center gap-1 text-destructive">
            <ExclamationCircleIcon className="h-4 w-4" />
            <span className="font-medium">{failureCount}</span>
            <span>failed</span>
          </div>
        )}
      </div>

      {/* History list */}
      <div className="border rounded-lg divide-y">
        {history.map((item, idx) => (
          <div key={`${item.cast_hash}-${item.action}-${idx}`} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {item.action === 'like' ? (
                  <HeartIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <ArrowPathIcon className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm font-medium capitalize">{item.action}</span>
              </div>
              <code className="text-xs text-muted-foreground">{item.cast_hash.slice(0, 8)}...</code>
              {item.status === 'failed' && (
                <Badge variant="destructive" className="text-xs">
                  Failed
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(item.processed_at), { addSuffix: true })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
