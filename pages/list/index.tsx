import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { fetchAndAddUserProfile, getProfileFetchIfNeeded } from '@/common/helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import ProfileInfo from '@/common/components/ProfileInfo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProfileSearchDropdown } from '@/common/components/ProfileSearchDropdown';
import { useListStore } from '@/stores/useListStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { List } from '@/common/types/database.types';
import { FidListContent, isFidListContent } from '@/common/types/list.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { lists, getFidLists, hydrate, addFidList, updateFidList, addFidToList, removeFidFromList, removeList } =
    useListStore();

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<User | undefined>(undefined);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultProfiles, setDefaultProfiles] = useState<User[]>([]);
  const fidToData = useDataStore((state) => state.fidToData);

  // Get active list
  const activeList = activeListId ? lists.find((list) => list.id === activeListId) : null;
  const fidLists = getFidLists();

  // Load profile data for users in the active list
  const loadProfileData = async (fidList: FidListContent) => {
    if (!fidList.fids || fidList.fids.length === 0) return;

    // Load profile data for each FID in the list
    const viewerFid = process.env.NEXT_PUBLIC_APP_FID!;

    // Process in batches to avoid overwhelming the API
    const promises = fidList.fids.map((fid) =>
      getProfileFetchIfNeeded({
        fid,
        viewerFid,
      }).catch((error) => {
        console.error(`Failed to fetch profile for FID ${fid}:`, error);
        return null;
      })
    );

    await Promise.all(promises);
  };

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await hydrate();
      const fidLists = getFidLists();
      if (fidLists.length > 0 && !activeListId) {
        setActiveListId(fidLists[0].id);

        // Load profile data for the first list
        if (fidLists[0] && isFidListContent(fidLists[0].contents)) {
          await loadProfileData(fidLists[0].contents as FidListContent);
        }
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);

  // Load profile data when active list changes
  useEffect(() => {
    if (activeList && isFidListContent(activeList.contents)) {
      loadProfileData(activeList.contents as FidListContent);
    }
  }, [activeList]);

  // Create a new list
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a name for the list',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addFidList(newListName, []);
      setNewListName('');
      setIsCreatingList(false);
      toast({
        title: 'Success',
        description: 'List created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create list: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Add user to list
  const handleAddUser = async () => {
    if (!selectedProfile || !activeListId) return;

    try {
      await addFidToList(activeListId, selectedProfile.fid.toString(), selectedProfile.username);
      setSelectedProfile(undefined);
      toast({
        title: 'Success',
        description: `Added ${selectedProfile.username} to list`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add user to list: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Remove user from list
  const handleRemoveUser = async (fid: string, username: string) => {
    if (!activeListId) return;

    try {
      await removeFidFromList(activeListId, fid);
      toast({
        title: 'Success',
        description: `Removed ${username} from list`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to remove user from list: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Delete entire list
  const handleDeleteList = async (listId: string, listName: string) => {
    try {
      await removeList(listId);

      // If the deleted list was active, set a new active list
      if (activeListId === listId) {
        const remainingLists = getFidLists();
        if (remainingLists.length > 0) {
          setActiveListId(remainingLists[0].id);
        } else {
          setActiveListId(null);
        }
      }

      toast({
        title: 'Success',
        description: `Deleted list: ${listName}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to delete list: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Render list of users in the active list
  const renderListUsers = () => {
    if (!activeList || !isFidListContent(activeList.contents)) {
      return <div className="text-center py-4">No users in this list</div>;
    }

    const content = activeList.contents as FidListContent;

    if (!content.fids || content.fids.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No users in this list. Add users using the search above.
        </div>
      );
    }

    return (
      <ScrollArea className="h-[450px] pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {content.fids.map((fid) => {
            const displayName = content.displayNames?.[fid] || `FID: ${fid}`;

            return (
              <Card key={`list-user-${fid}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <ProfileInfo
                        fid={parseInt(fid)}
                        viewerFid={parseInt(process.env.NEXT_PUBLIC_APP_FID || '0')}
                        hideBio={true}
                        showFollowButton={false}
                        wideFormat={false}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(fid, displayName)}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  // Render list of available lists as tabs
  const renderListTabs = () => {
    if (fidLists.length === 0) {
      return (
        <div className="text-center p-4">
          <p className="text-muted-foreground mb-4">You don&apos;t have any lists yet.</p>
          <Button onClick={() => setIsCreatingList(true)}>Create your first list</Button>
        </div>
      );
    }

    return (
      <Tabs value={activeListId || fidLists[0].id} onValueChange={setActiveListId} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            {fidLists.map((list) => (
              <TabsTrigger key={`list-tab-${list.id}`} value={list.id}>
                {list.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button size="sm" onClick={() => setIsCreatingList(true)}>
            <PlusIcon className="h-4 w-4 mr-1" />
            New List
          </Button>
        </div>

        {fidLists.map((list) => (
          <TabsContent key={`list-content-${list.id}`} value={list.id} className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{list.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {isFidListContent(list.contents) && list.contents.fids
                    ? `${list.contents.fids.length} users`
                    : '0 users'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteList(list.id, list.name)}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete List
              </Button>
            </div>

            <div className="flex items-center space-x-2 my-4">
              <ProfileSearchDropdown
                defaultProfiles={defaultProfiles}
                selectedProfile={selectedProfile}
                setSelectedProfile={setSelectedProfile}
              />
              <Button onClick={handleAddUser} disabled={!selectedProfile}>
                Add to List
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Users in this list</CardTitle>
              </CardHeader>
              <CardContent>{renderListUsers()}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Navigation breadcrumb */}
      <div className="mb-6">
        <Link href="/lists" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to all lists
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage User Lists</h1>
          <p className="text-muted-foreground">Create and manage lists of users to customize your feed</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        renderListTabs()
      )}

      {/* Create List Dialog */}
      <Dialog open={isCreatingList} onOpenChange={setIsCreatingList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new list</DialogTitle>
            <DialogDescription>Enter a name for your new user list</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="list-name">List Name</Label>
            <Input
              id="list-name"
              placeholder="My Favorite Creators"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingList(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList}>Create List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
