import React from 'react';
import { useRouter } from 'next/navigation';
import { List } from '@/common/types/database.types';
import { SearchListContent, isSearchListContent } from '@/common/types/list.types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MagnifyingGlassIcon, BellIcon, PlusIcon, PencilIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useListStore } from '@/stores/useListStore';

interface SearchListsViewProps {
  lists: List[];
  isLoading: boolean;
}

export function SearchListsView({ lists, isLoading }: SearchListsViewProps) {
  const router = useRouter();
  const { setSelectedListId } = useListStore();

  const handleListClick = (listId: string) => {
    setSelectedListId(listId);
    router.push('/feeds');
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[180px]" />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-12">
        <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No saved searches yet</h3>
        <p className="text-muted-foreground mb-4">Create searches to monitor keywords and topics on Farcaster</p>
        <Button onClick={() => router.push('/search')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Your First Search
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Monitor keywords and get notified about new casts</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push('/list/search')}>
            <PencilIcon className="h-4 w-4 mr-2" />
            Manage
          </Button>
          <Button size="sm" onClick={() => router.push('/search')}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Search
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          if (!isSearchListContent(list.contents)) return null;
          const content = list.contents;
          const hasEmailEnabled = content.enabled_daily_email;

          return (
            <Card
              key={list.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleListClick(list.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {list.name}
                      {hasEmailEnabled && <BellIcon className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                    <CardDescription className="mt-1">Searching for: &quot;{content.term}&quot;</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {content.filters?.interval && <Badge variant="secondary">{content.filters.interval}</Badge>}
                  {content.filters?.channelId && <Badge variant="secondary">/{content.filters.channelId}</Badge>}
                  {/*{hasEmailEnabled && <Badge variant="outline">Daily emails</Badge>}*/}
                </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(list.created_at))} ago
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
