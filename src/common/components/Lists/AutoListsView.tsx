import React from 'react';
import { useRouter } from 'next/router';
import { List } from '@/common/types/database.types';
import { AutoInteractionListContent, isAutoInteractionListContent } from '@/common/types/list.types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { BoltIcon, PlusIcon, HeartIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useAccountStore } from '@/stores/useAccountStore';
import { useDataStore } from '@/stores/useDataStore';

interface AutoListsViewProps {
  lists: List[];
  isLoading: boolean;
}

export function AutoListsView({ lists, isLoading }: AutoListsViewProps) {
  const router = useRouter();
  const { accounts } = useAccountStore();
  const fidToData = useDataStore((state) => state.fidToData);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[220px]" />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-12">
        <BoltIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No auto-interactions yet</h3>
        <p className="text-muted-foreground mb-4">Set up automated likes and recasts between your accounts</p>
        <Button onClick={() => router.push('/list/auto-interactions')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Your First Automation
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Automatically interact with casts from specific accounts</p>
        <Button size="sm" onClick={() => router.push('/list/auto-interactions')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          const content = list.contents as AutoInteractionListContent;
          const sourceAccount = accounts.find((a) => a.id === content.sourceAccountId);
          const previewFids = content.fids.slice(0, 3);

          return (
            <Card
              key={list.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/list/auto-interactions')}
            >
              <CardHeader>
                <CardTitle className="text-lg">{list.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="text-xs">Acting as:</span>
                  {sourceAccount && (
                    <span className="font-medium">
                      {sourceAccount.name || `Account ${sourceAccount.id.slice(0, 8)}`}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {content.actionType === 'like' || content.actionType === 'both' ? (
                      <HeartIcon className="h-4 w-4 text-red-500" />
                    ) : null}
                    {content.actionType === 'recast' || content.actionType === 'both' ? (
                      <ArrowPathIcon className="h-4 w-4 text-green-500" />
                    ) : null}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {content.actionType === 'like' && 'Likes only'}
                    {content.actionType === 'recast' && 'Recasts only'}
                    {content.actionType === 'both' && 'Likes & recasts'}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monitoring {content.fids.length} accounts:</p>
                  <div className="flex -space-x-2">
                    {previewFids.map((fid) => {
                      const userData = fidToData[parseInt(fid)];
                      return (
                        <Avatar key={fid} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={userData?.pfp_url} />
                          <AvatarFallback className="text-xs">
                            {userData?.username?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {content.fids.length > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
                        +{content.fids.length - 3}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {content.onlyTopCasts && (
                    <Badge variant="secondary" className="text-xs">
                      Top-level only
                    </Badge>
                  )}
                  {content.requireMentions && content.requireMentions.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Requires mentions
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                <div className="flex w-full justify-between items-center">
                  <span>Created {formatDistanceToNow(new Date(list.created_at))} ago</span>
                  {content.lastProcessedHash && (
                    <Badge variant="outline" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
