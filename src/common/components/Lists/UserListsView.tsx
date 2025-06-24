import React from 'react';
import { useRouter } from 'next/router';
import { List } from '@/common/types/database.types';
import { FidListContent, isFidListContent } from '@/common/types/list.types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useListStore } from '@/stores/useListStore';
import { useDataStore } from '@/stores/useDataStore';

interface UserListsViewProps {
  lists: List[];
  isLoading: boolean;
}

export function UserListsView({ lists, isLoading }: UserListsViewProps) {
  const router = useRouter();
  const { setSelectedListId } = useListStore();
  const fidToData = useDataStore((state) => state.fidToData);

  const handleListClick = (listId: string) => {
    setSelectedListId(listId);
    router.push('/feeds');
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[200px]" />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-12">
        <UserGroupIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No user lists yet</h3>
        <p className="text-muted-foreground mb-4">Create lists to organize and follow groups of users</p>
        <Button onClick={() => router.push('/list')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Your First List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Organize users into lists to see their casts in custom feeds</p>
        <Button size="sm" onClick={() => router.push('/list')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New List
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          const content = list.contents as FidListContent;
          const previewFids = content.fids.slice(0, 5);

          return (
            <Card
              key={list.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleListClick(list.id)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{list.name}</CardTitle>
                <CardDescription>
                  {content.fids.length} {content.fids.length === 1 ? 'user' : 'users'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex -space-x-2">
                  {previewFids.map((fid) => {
                    const userData = fidToData[parseInt(fid)];
                    return (
                      <Avatar key={fid} className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={userData?.pfp_url} />
                        <AvatarFallback>{userData?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                  {content.fids.length > 5 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
                      +{content.fids.length - 5}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex w-full justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(list.created_at))} ago
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push('/list');
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
