'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UUID } from 'crypto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useListStore } from '@/stores/useListStore';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon, CheckIcon, EyeIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { SearchListContent, isSearchListContent } from '@/common/types/list.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Interval } from '@/common/types/types';
import { SearchMode, SortType } from '@/services/searchService';
import { useAccountStore } from '@/stores/useAccountStore';

export default function SearchListsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { lists, getSearchLists, hydrate, addList, updateList, removeList, setSelectedListId } = useListStore();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form state for new list
  const [newListName, setNewListName] = useState('');
  const [newSearchTerm, setNewSearchTerm] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editTerm, setEditTerm] = useState('');
  const [editInterval, setEditInterval] = useState<string>(Interval.d7);
  const [editSortType, setEditSortType] = useState<string>(SortType.DESC_CHRON);
  const [editAuthorFid, setEditAuthorFid] = useState<string>('');
  const [editChannelId, setEditChannelId] = useState<string>('');
  const [editParentUrl, setEditParentUrl] = useState<string>('');

  const searchLists = getSearchLists();
  const activeList = activeListId ? lists.find((list) => list.id === activeListId) : null;

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await hydrate();
      const searchLists = getSearchLists();
      if (searchLists.length > 0 && !activeListId) {
        setActiveListId(searchLists[0].id);
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);

  // Load form values when active list changes
  useEffect(() => {
    if (activeList && isSearchListContent(activeList.contents)) {
      const content = activeList.contents as SearchListContent;
      setEditName(activeList.name);
      setEditTerm(content.term || '');
      setEditInterval(content.filters?.interval || Interval.d7);
      setEditSortType(content.filters?.sortType || SortType.DESC_CHRON);
      setEditAuthorFid(content.filters?.authorFid?.toString() || '');
      setEditChannelId(content.filters?.channelId || '');
      setEditParentUrl(content.filters?.parentUrl || '');
    }
  }, [activeList]);

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a name for the search',
        variant: 'destructive',
      });
      return;
    }

    if (!newSearchTerm.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a search term',
        variant: 'destructive',
      });
      return;
    }

    const newIdx = lists.reduce((max, list) => Math.max(max, list.idx), 0) + 1;

    const contents: SearchListContent = {
      term: newSearchTerm,
      filters: {
        interval: Interval.d7,
        sortType: SortType.DESC_CHRON,
      },
    };

    const result = await addList({
      name: newListName,
      type: 'search',
      contents,
      idx: newIdx,
      account_id: selectedAccount?.id || undefined,
    });

    if (result.success) {
      // Refresh and select the new list
      await hydrate();
      const updatedLists = getSearchLists();
      const newList = updatedLists.find((l) => l.name === newListName);
      if (newList) {
        setActiveListId(newList.id);
      }

      setNewListName('');
      setNewSearchTerm('');
      setIsCreatingList(false);

      toast({
        title: 'Success',
        description: 'Search list created successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!activeList) return;

    if (!editName.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a name',
        variant: 'destructive',
      });
      return;
    }

    if (!editTerm.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a search term',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    const updatedContent: SearchListContent = {
      term: editTerm,
      filters: {
        interval: editInterval,
        sortType: editSortType as 'desc_chron' | 'algorithmic',
        ...(editAuthorFid ? { authorFid: Number(editAuthorFid) } : {}),
        ...(editChannelId ? { channelId: editChannelId } : {}),
        ...(editParentUrl ? { parentUrl: editParentUrl } : {}),
      },
    };

    const result = await updateList({
      id: activeList.id,
      name: editName,
      contents: updatedContent,
    });

    if (result.success) {
      setSaveSuccess(true);
      toast({
        title: 'Success',
        description: 'Search list updated successfully',
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  };

  const handleDeleteList = async () => {
    if (!activeList) return;

    const result = await removeList(activeList.id as UUID);

    if (result.success) {
      setDeleteConfirmOpen(false);

      // Select another list if available
      const remainingLists = getSearchLists().filter((l) => l.id !== activeList.id);
      if (remainingLists.length > 0) {
        setActiveListId(remainingLists[0].id);
      } else {
        setActiveListId(null);
      }

      toast({
        title: 'Success',
        description: 'Search list deleted successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleViewFeed = () => {
    if (!activeList) return;
    setSelectedListId(activeList.id as UUID);
    router.push('/feeds');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <Skeleton className="h-[500px]" />
          </div>
          <div className="col-span-9">
            <Skeleton className="h-[500px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Navigation breadcrumb */}
      <div className="mb-6">
        <Link href="/lists" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to all lists
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MagnifyingGlassIcon className="h-8 w-8 text-primary" />
          Search Lists
        </h1>
        <p className="text-muted-foreground mt-2">Create and manage saved searches to monitor keywords on Farcaster</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar with list of search lists */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Your Searches</CardTitle>
                <Dialog open={isCreatingList} onOpenChange={setIsCreatingList}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Search</DialogTitle>
                      <DialogDescription>Create a saved search to monitor keywords on Farcaster</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="new-name">Name</Label>
                        <Input
                          id="new-name"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="e.g., Web3 News"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="new-term">Search Term</Label>
                        <Input
                          id="new-term"
                          value={newSearchTerm}
                          onChange={(e) => setNewSearchTerm(e.target.value)}
                          placeholder="e.g., ethereum OR bitcoin"
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Use operators like OR, from:username, channel:name
                        </p>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreatingList(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateList}>Create Search</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {searchLists.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No saved searches yet</div>
                ) : (
                  <div className="space-y-1">
                    {searchLists.map((list) => {
                      const content = list.contents as SearchListContent;
                      return (
                        <div
                          key={list.id}
                          onClick={() => setActiveListId(list.id)}
                          className={cn(
                            'px-4 py-2 cursor-pointer transition-colors',
                            activeListId === list.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          )}
                        >
                          <div className="font-medium truncate">{list.name}</div>
                          <div className="text-xs opacity-70 truncate">&quot;{content.term}&quot;</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="col-span-9">
          {activeList && isSearchListContent(activeList.contents) ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{activeList.name}</CardTitle>
                    <CardDescription>Edit your saved search settings</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleViewFeed}>
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View Feed
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">List Name</Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name for this search"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-term">Search Term</Label>
                      <Input
                        id="edit-term"
                        value={editTerm}
                        onChange={(e) => setEditTerm(e.target.value)}
                        placeholder="e.g., ethereum OR bitcoin"
                      />
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium mb-4">Search Filters</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-interval">Time Period</Label>
                        <Select value={editInterval} onValueChange={setEditInterval}>
                          <SelectTrigger id="edit-interval">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={Interval.d1}>Last 24 hours</SelectItem>
                            <SelectItem value={Interval.d7}>Last 7 days</SelectItem>
                            <SelectItem value={Interval.d14}>Last 14 days</SelectItem>
                            <SelectItem value={Interval.d30}>Last 30 days</SelectItem>
                            <SelectItem value={Interval.d90}>Last 90 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sort">Sort By</Label>
                        <Select value={editSortType} onValueChange={setEditSortType}>
                          <SelectTrigger id="edit-sort">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SortType.DESC_CHRON}>Latest First</SelectItem>
                            <SelectItem value={SortType.ALGORITHMIC}>Most Relevant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-author">Author FID (optional)</Label>
                        <Input
                          id="edit-author"
                          type="number"
                          value={editAuthorFid}
                          onChange={(e) => setEditAuthorFid(e.target.value)}
                          placeholder="e.g., 3621"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-channel">Channel (optional)</Label>
                        <Input
                          id="edit-channel"
                          value={editChannelId}
                          onChange={(e) => setEditChannelId(e.target.value)}
                          placeholder="e.g., farcaster"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="edit-parent">Parent URL (optional)</Label>
                        <Input
                          id="edit-parent"
                          value={editParentUrl}
                          onChange={(e) => setEditParentUrl(e.target.value)}
                          placeholder="Filter by parent cast URL"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="border-t pt-6">
                    <Button onClick={handleSaveChanges} disabled={isSaving} className="min-w-[140px]">
                      {isSaving ? (
                        'Saving...'
                      ) : saveSuccess ? (
                        <>
                          <CheckIcon className="w-4 h-4 mr-2" />
                          Saved
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a search to edit or create a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Search</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{activeList?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteList}>
              Delete Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
