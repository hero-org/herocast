'use client';

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { UsersIcon } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BulkAddUsersDialog } from '@/common/components/BulkAddUsersDialog';
import ProfileInfo from '@/common/components/ProfileInfo';
import { ProfileSearchDropdown } from '@/common/components/ProfileSearchDropdown';
import { LIST_SIZE_WARNING_THRESHOLD, MAX_USERS_PER_LIST } from '@/common/constants/listLimits';
import { type FidListContent, isFidListContent } from '@/common/types/list.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getProfileFromBulk, useBulkProfiles } from '@/hooks/queries/useBulkProfiles';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';

export default function ListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    lists,
    getFidLists,
    hydrate,
    addFidList,
    updateFidList,
    addFidToList,
    removeFidFromList,
    removeList,
    updateList,
  } = useListStore();

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<User | undefined>(undefined);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultProfiles, setDefaultProfiles] = useState<User[]>([]);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<{ id: string; name: string } | null>(null);
  const USERS_PER_PAGE = 30;

  // Get viewer FID from selected account
  const accounts = useAccountStore((state) => state.accounts);
  const selectedAccountIdx = useAccountStore((state) => state.selectedAccountIdx);
  const viewerFid = accounts[selectedAccountIdx]?.platformAccountId
    ? parseInt(accounts[selectedAccountIdx].platformAccountId!)
    : parseInt(process.env.NEXT_PUBLIC_APP_FID || '3');

  // Get active list
  const activeList = activeListId ? lists.find((list) => list.id === activeListId) : null;
  const fidLists = getFidLists();

  // Collect all FIDs that need to be loaded for the current view
  const fidsToLoad = useMemo(() => {
    if (!activeList || !isFidListContent(activeList.contents)) return [];

    const content = activeList.contents as FidListContent;
    if (!content.fids || content.fids.length === 0) return [];

    // Filter by search term if present
    let filteredFids = content.fids;
    if (searchTerm) {
      filteredFids = content.fids.filter((fid) => {
        const displayName = content.displayNames?.[fid] || '';
        const searchLower = searchTerm.toLowerCase();
        return fid.includes(searchTerm) || displayName.toLowerCase().includes(searchLower);
      });
    }

    // Get FIDs for current page
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const pageFids = filteredFids.slice(startIndex, endIndex);

    // Convert to numbers
    return pageFids.map((fid) => parseInt(fid));
  }, [activeList, currentPage, searchTerm]);

  // Fetch profiles using React Query
  const { data: profiles, isLoading: isLoadingProfiles } = useBulkProfiles(fidsToLoad, {
    viewerFid,
    includeAdditionalInfo: false,
    enabled: fidsToLoad.length > 0,
  });

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await hydrate();
      const fidLists = getFidLists();
      if (fidLists.length > 0 && !activeListId) {
        setActiveListId(fidLists[0].id);
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);

  // Reset to page 1 when switching lists
  useEffect(() => {
    if (activeList && isFidListContent(activeList.contents)) {
      setCurrentPage(1);
      setSearchTerm('');
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

    const result = await addFidList(newListName, []);

    if (result.success) {
      // Get the newly created list and set it as active
      const updatedLists = getFidLists();
      const newList = updatedLists[updatedLists.length - 1]; // New list is added at the end
      if (newList) {
        setActiveListId(newList.id);
      }

      setNewListName('');
      setIsCreatingList(false);
      toast({
        title: 'Success',
        description: 'List created successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Add user to list
  const handleAddUser = async () => {
    if (!selectedProfile || !activeListId) return;

    const result = await addFidToList(activeListId, selectedProfile.fid.toString(), selectedProfile.username);

    if (result.success) {
      setSelectedProfile(undefined);
      toast({
        title: 'Success',
        description: `Added ${selectedProfile.username} to list`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Remove user from list
  const handleRemoveUser = async (fid: string, username: string) => {
    if (!activeListId) return;

    const result = await removeFidFromList(activeListId, fid);

    if (result.success) {
      toast({
        title: 'Success',
        description: `Removed ${username} from list`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Delete entire list
  const handleDeleteList = async () => {
    if (!listToDelete) return;

    const result = await removeList(listToDelete.id);

    if (result.success) {
      // If the deleted list was active, set a new active list
      if (activeListId === listToDelete.id) {
        const remainingLists = getFidLists();
        if (remainingLists.length > 0) {
          setActiveListId(remainingLists[0].id);
        } else {
          setActiveListId(null);
        }
      }

      toast({
        title: 'Success',
        description: `Deleted list: ${listToDelete.name}`,
      });

      setDeleteConfirmOpen(false);
      setListToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Handle bulk add users
  const handleBulkAddUsers = async (
    users: Array<{ fid: string; displayName: string }>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!activeListId || !activeList) {
      return { success: false, error: 'No active list selected' };
    }

    try {
      // Get current list content
      const content = activeList.contents as FidListContent;
      const currentFids = content.fids || [];
      const currentDisplayNames = content.displayNames || {};

      // Check how many new users would be added
      const newUsersToAdd = users.filter(({ fid }) => !currentFids.includes(fid));

      // Check if adding these users would exceed the limit
      if (currentFids.length + newUsersToAdd.length > MAX_USERS_PER_LIST) {
        const availableSlots = MAX_USERS_PER_LIST - currentFids.length;
        return {
          success: false,
          error: `Cannot add ${newUsersToAdd.length} users. This list has ${currentFids.length} users and can only add ${availableSlots} more (max ${MAX_USERS_PER_LIST} users per list).`,
        };
      }

      // Merge new users with existing ones
      const newFids = [...currentFids];
      const newDisplayNames = { ...currentDisplayNames };

      users.forEach(({ fid, displayName }) => {
        if (!currentFids.includes(fid)) {
          newFids.push(fid);
          newDisplayNames[fid] = displayName;
        }
      });

      // Create a new content object with both FIDs and display names
      const updatedContent: FidListContent = {
        fids: newFids,
        displayNames: newDisplayNames,
      };

      // Use the store's update method which properly handles RLS
      const updateResult = await updateList({
        id: activeListId,
        name: activeList.name,
        contents: updatedContent,
      });

      if (!updateResult.success) {
        console.error('Failed to update list:', updateResult.error);
        return {
          success: false,
          error: updateResult.error,
        };
      }

      // Refresh the list to ensure consistency
      await hydrate();

      // React Query will automatically fetch profiles when they're rendered
      return { success: true };
    } catch (error) {
      console.error('Failed to bulk add users:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add users to the list',
      };
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

    // Filter users based on search term
    let filteredFids = content.fids;
    if (searchTerm) {
      filteredFids = content.fids.filter((fid) => {
        const displayName = content.displayNames?.[fid] || '';
        const profile = getProfileFromBulk(profiles, parseInt(fid));
        const username = profile?.username || '';
        const searchLower = searchTerm.toLowerCase();
        return (
          fid.includes(searchTerm) ||
          displayName.toLowerCase().includes(searchLower) ||
          username.toLowerCase().includes(searchLower)
        );
      });
    }

    // Pagination
    const totalPages = Math.ceil(filteredFids.length / USERS_PER_PAGE);
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const currentPageFids = filteredFids.slice(startIndex, endIndex);

    // Reset to page 1 if current page is out of bounds
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }

    return (
      <div className="space-y-4">
        {/* Search and stats bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search users in list..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-xs"
            />
            <span className="text-sm text-muted-foreground">
              {filteredFids.length} {filteredFids.length === 1 ? 'user' : 'users'}
              {searchTerm && ` matching "${searchTerm}"`}
              {content.fids.length > 0 && ` (${content.fids.length}/${MAX_USERS_PER_LIST} total)`}
            </span>
          </div>
        </div>

        {/* User grid - only render current page */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPageFids.map((fid) => {
            const displayName = content.displayNames?.[fid] || `FID: ${fid}`;
            const profile = getProfileFromBulk(profiles, parseInt(fid));

            return (
              <Card key={`list-user-${fid}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {profile ? (
                        <ProfileInfo
                          fid={parseInt(fid)}
                          viewerFid={viewerFid}
                          hideBio={true}
                          showFollowButton={false}
                          wideFormat={false}
                          compact={true}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                          <div>
                            <div className="font-medium">{displayName}</div>
                            <div className="text-sm text-muted-foreground">Loading...</div>
                          </div>
                        </div>
                      )}
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {/* Show first page */}
              <Button variant={currentPage === 1 ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(1)}>
                1
              </Button>

              {/* Show ellipsis if needed */}
              {currentPage > 3 && <span className="px-2">...</span>}

              {/* Show nearby pages */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(2, Math.min(currentPage - 2 + i, totalPages - 1));
                if (page > 1 && page < totalPages && Math.abs(page - currentPage) <= 2) {
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                }
                return null;
              }).filter(Boolean)}

              {/* Show ellipsis if needed */}
              {currentPage < totalPages - 2 && <span className="px-2">...</span>}

              {/* Show last page */}
              {totalPages > 1 && (
                <Button
                  variant={currentPage === totalPages ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
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
          <TabsContent key={`list-content-${list.id}`} value={list.id} className="space-y-6">
            {/* List header with stats and delete button */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{list.name}</h3>
                    <p className="text-muted-foreground">
                      {isFidListContent(list.contents) && list.contents.fids
                        ? `${list.contents.fids.length} users in this list`
                        : 'No users in this list yet'}
                    </p>
                    {isFidListContent(list.contents) &&
                      list.contents.fids &&
                      list.contents.fids.length >= LIST_SIZE_WARNING_THRESHOLD && (
                        <p className="text-sm text-warning mt-1">
                          ⚠️ Approaching limit: {MAX_USERS_PER_LIST - list.contents.fids.length} slots remaining (max{' '}
                          {MAX_USERS_PER_LIST})
                        </p>
                      )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setListToDelete({ id: list.id, name: list.name });
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                {isFidListContent(list.contents) &&
                  list.contents.fids &&
                  list.contents.fids.length >= MAX_USERS_PER_LIST && (
                    <p className="text-sm text-muted-foreground mt-3">
                      This list has reached the maximum limit of {MAX_USERS_PER_LIST} users. Remove some users to add
                      new ones.
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Add users section */}
            <Card>
              <CardHeader>
                <CardTitle>Add Users</CardTitle>
                <CardDescription>Search for individual users or bulk add multiple users at once</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <ProfileSearchDropdown
                      defaultProfiles={defaultProfiles}
                      selectedProfile={selectedProfile}
                      setSelectedProfile={setSelectedProfile}
                      placeholder="Add user to list..."
                    />
                  </div>
                  <Button
                    onClick={handleAddUser}
                    disabled={
                      !selectedProfile ||
                      (isFidListContent(list.contents) &&
                        list.contents.fids &&
                        list.contents.fids.length >= MAX_USERS_PER_LIST)
                    }
                    className="sm:w-auto w-full"
                  >
                    Add to List
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkAddOpen(true)}
                    disabled={
                      isFidListContent(list.contents) && list.contents.fids && list.contents.fids.length >= 1000
                    }
                    className="gap-2 sm:w-auto w-full"
                  >
                    <UsersIcon className="h-4 w-4" />
                    Bulk Add Users
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Users list */}
            <Card>
              <CardHeader>
                <CardTitle>List Members</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">{renderListUsers()}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  return (
    <div className="px-6 lg:px-8 py-8 max-w-7xl">
      {/* Navigation breadcrumb */}
      <div className="mb-8">
        <Link
          href="/lists"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all lists
        </Link>
      </div>

      {/* Header section */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Manage User Lists</h1>
        <p className="text-lg text-muted-foreground">Create and manage lists of users to customize your feed</p>
      </div>

      <div className="max-w-6xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          renderListTabs()
        )}
      </div>

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

      {/* Bulk Add Users Dialog */}
      {activeList && isFidListContent(activeList.contents) && (
        <BulkAddUsersDialog
          open={isBulkAddOpen}
          onOpenChange={setIsBulkAddOpen}
          onAddUsers={handleBulkAddUsers}
          existingFids={(activeList.contents as FidListContent).fids || []}
          viewerFid={viewerFid.toString()}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{listToDelete?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteList}>
              Delete List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
