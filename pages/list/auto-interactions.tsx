import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { UUID } from 'crypto';
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
import { useListStore, isAutoInteractionList } from '@/stores/useListStore';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { BoltIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { List } from '@/common/types/database.types';
import { AutoInteractionListContent, isAutoInteractionListContent } from '@/common/types/list.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AutoInteractionSettings } from '@/common/components/Lists/AutoInteractionSettings';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import ProfileInfo from '@/common/components/ProfileInfo';
import { useDataStore } from '@/stores/useDataStore';
import { Skeleton } from '@/components/ui/skeleton';

export default function AutoInteractionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    lists,
    getAutoInteractionLists,
    hydrate,
    addAutoInteractionList,
    updateAutoInteractionSettings,
    addFidToList,
    removeFidFromList,
    removeList,
  } = useListStore();
  const fidToData = useDataStore((state) => state.fidToData);

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<User | undefined>(undefined);

  // Auto-interaction settings state
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [actionType, setActionType] = useState<'like' | 'recast' | 'both'>('both');
  const [onlyTopCasts, setOnlyTopCasts] = useState(true);
  const [requireMentions, setRequireMentions] = useState<string[]>([]);
  const [targetFids, setTargetFids] = useState<string[]>([]);

  const autoInteractionLists = getAutoInteractionLists();
  const activeList = activeListId ? lists.find((list) => list.id === activeListId) : null;

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await hydrate();
      const autoLists = getAutoInteractionLists();
      if (autoLists.length > 0 && !activeListId) {
        setActiveListId(autoLists[0].id);
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);

  const handleCreateList = async () => {
    if (!newListName.trim() || !sourceAccountId || targetFids.length === 0) {
      toast({
        title: 'Error',
        description: 'Please provide a name, select an account, and add target accounts',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addAutoInteractionList(
        newListName,
        targetFids,
        sourceAccountId,
        actionType,
        onlyTopCasts,
        requireMentions.length > 0 ? requireMentions : undefined
      );

      // Reset form
      setNewListName('');
      setTargetFids([]);
      setRequireMentions([]);
      setIsCreatingList(false);

      toast({
        title: 'Success',
        description: 'Auto-interaction list created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to create list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleAddTargetAccount = (profile: User) => {
    if (!targetFids.includes(profile.fid.toString())) {
      setTargetFids([...targetFids, profile.fid.toString()]);
    }
  };

  const handleRemoveTargetAccount = (fid: string) => {
    setTargetFids(targetFids.filter((f) => f !== fid));
  };

  const handleUpdateSettings = async () => {
    if (!activeList || !isAutoInteractionListContent(activeList.contents)) return;

    try {
      await updateAutoInteractionSettings(activeList.id as UUID, {
        sourceAccountId,
        actionType,
        onlyTopCasts,
        requireMentions: requireMentions.length > 0 ? requireMentions : undefined,
      });

      toast({
        title: 'Success',
        description: 'Settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      await removeList(listId as UUID);
      if (activeListId === listId) {
        setActiveListId(null);
      }
      toast({
        title: 'Success',
        description: 'List deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to delete list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  // Load settings when active list changes
  useEffect(() => {
    if (activeList && isAutoInteractionListContent(activeList.contents)) {
      const content = activeList.contents as AutoInteractionListContent;
      setSourceAccountId(content.sourceAccountId || '');
      setActionType(content.actionType || 'both');
      setOnlyTopCasts(content.onlyTopCasts ?? true);
      setRequireMentions(content.requireMentions || []);
    }
  }, [activeList]);

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
    <>
      <Head>
        <title>Auto-Interactions - herocast</title>
      </Head>

      <div className="container mx-auto p-6">
        {/* Navigation breadcrumb */}
        <div className="mb-6">
          <Link href="/lists" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to all lists
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BoltIcon className="h-8 w-8 text-primary" />
            Auto-Interactions
          </h1>
          <p className="text-muted-foreground mt-2">Automatically like and recast content from specific accounts</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar with list of auto-interaction lists */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Your Lists</CardTitle>
                  <Dialog open={isCreatingList} onOpenChange={setIsCreatingList}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create Auto-Interaction List</DialogTitle>
                        <DialogDescription>Set up automatic likes and recasts between your accounts</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="name">List Name</Label>
                          <Input
                            id="name"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="e.g., Business Account Auto-Likes"
                          />
                        </div>

                        <div>
                          <Label>Target Accounts</Label>
                          <ProfileSearchDropdown
                            defaultProfiles={[]}
                            selectedProfile={undefined}
                            setSelectedProfile={handleAddTargetAccount}
                            placeholder="Add accounts to monitor"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            {targetFids.map((fid) => {
                              const profile = fidToData[parseInt(fid)];
                              return (
                                <Badge key={fid} variant="secondary">
                                  @{profile?.username || `fid:${fid}`}
                                  <button
                                    onClick={() => handleRemoveTargetAccount(fid)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        </div>

                        <AutoInteractionSettings
                          sourceAccountId={sourceAccountId}
                          actionType={actionType}
                          onlyTopCasts={onlyTopCasts}
                          requireMentions={requireMentions}
                          onSourceAccountChange={setSourceAccountId}
                          onActionTypeChange={setActionType}
                          onOnlyTopCastsChange={setOnlyTopCasts}
                          onRequireMentionsChange={setRequireMentions}
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
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {autoInteractionLists.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No auto-interaction lists yet</div>
                  ) : (
                    <div className="space-y-1">
                      {autoInteractionLists.map((list) => (
                        <div
                          key={list.id}
                          onClick={() => setActiveListId(list.id)}
                          className={cn(
                            'px-4 py-2 cursor-pointer transition-colors',
                            activeListId === list.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          )}
                        >
                          <div className="font-medium">{list.name}</div>
                          {isAutoInteractionListContent(list.contents) && (
                            <div className="text-xs opacity-70">
                              {(list.contents as AutoInteractionListContent).fids.length} accounts
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main content area */}
          <div className="col-span-9">
            {activeList && isAutoInteractionListContent(activeList.contents) ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{activeList.name}</CardTitle>
                      <CardDescription>Manage auto-interaction settings and target accounts</CardDescription>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteList(activeList.id as string)}>
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="accounts">
                    <TabsList>
                      <TabsTrigger value="accounts">Target Accounts</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="accounts" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ProfileSearchDropdown
                            defaultProfiles={[]}
                            selectedProfile={selectedProfile}
                            setSelectedProfile={async (profile) => {
                              if (profile) {
                                await addFidToList(activeList.id as UUID, profile.fid.toString(), profile.username);
                                setSelectedProfile(undefined);
                              }
                            }}
                            placeholder="Add account to monitor"
                          />
                        </div>

                        <div className="border rounded-lg">
                          {(activeList.contents as AutoInteractionListContent).fids.map((fid) => (
                            <div key={fid} className="flex items-center justify-between p-3 border-b last:border-b-0">
                              <ProfileInfo fid={fid} />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFidFromList(activeList.id as UUID, fid)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="mt-4">
                      <AutoInteractionSettings
                        sourceAccountId={sourceAccountId}
                        actionType={actionType}
                        onlyTopCasts={onlyTopCasts}
                        requireMentions={requireMentions}
                        onSourceAccountChange={setSourceAccountId}
                        onActionTypeChange={setActionType}
                        onOnlyTopCastsChange={setOnlyTopCasts}
                        onRequireMentionsChange={setRequireMentions}
                      />
                      <div className="mt-6">
                        <Button onClick={handleUpdateSettings}>Save Settings</Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                      <div className="text-center text-muted-foreground py-8">History tracking coming soon</div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BoltIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a list to view details or create a new one</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
