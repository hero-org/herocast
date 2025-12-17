'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';

// Force dynamic rendering since we use useRouter which uses useSearchParams
export const dynamic = 'force-dynamic';
import Link from 'next/link';
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
import { BoltIcon, PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { List } from '@/common/types/database.types';
import { AutoInteractionListContent, isAutoInteractionListContent } from '@/common/types/list.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AutoInteractionSettings } from '@/common/components/Lists/AutoInteractionSettings';
import { AutoInteractionContentFilters } from '@/common/components/Lists/AutoInteractionContentFilters';
import { AutoInteractionHistory } from '@/common/components/Lists/AutoInteractionHistory';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import ProfileInfo from '@/common/components/ProfileInfo';
import { useBulkProfiles, getProfileFromBulk } from '@/hooks/queries/useBulkProfiles';
import { useAccountStore, AccountObjectType } from '@/stores/useAccountStore';
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
  const { accounts, selectedAccountIdx } = useAccountStore();
  const currentAccount = accounts[selectedAccountIdx];
  const viewerFid = currentAccount?.platformAccountId ? Number(currentAccount.platformAccountId) : 3;

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<User | undefined>(undefined);

  // Auto-interaction settings state
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [actionType, setActionType] = useState<'like' | 'recast' | 'both'>('both');
  const [onlyTopCasts, setOnlyTopCasts] = useState(true);
  const [requireMentions, setRequireMentions] = useState<string[]>([]);
  const [targetFids, setTargetFids] = useState<string[]>([]);
  const [feedSource, setFeedSource] = useState<'specific_users' | 'following'>('specific_users');
  const [requiredUrls, setRequiredUrls] = useState<string[]>([]);
  const [requiredKeywords, setRequiredKeywords] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch profiles for all FIDs used in the UI (targetFids + requireMentions)
  const allFids = [...new Set([...targetFids, ...requireMentions])].map(Number).filter(Boolean);
  const { data: profiles } = useBulkProfiles(allFids, { viewerFid });

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
    if (!newListName.trim() || !sourceAccountId) {
      toast({
        title: 'Error',
        description: 'Please provide a name and select an account',
        variant: 'destructive',
      });
      return;
    }

    // Validate based on feed source
    if (feedSource === 'specific_users' && targetFids.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one target account',
        variant: 'destructive',
      });
      return;
    }

    const result = await addAutoInteractionList(
      newListName,
      targetFids,
      sourceAccountId,
      actionType,
      onlyTopCasts,
      requireMentions.length > 0 ? requireMentions : undefined,
      feedSource,
      requiredUrls.length > 0 ? requiredUrls : undefined,
      requiredKeywords.length > 0 ? requiredKeywords : undefined
    );

    if (result.success) {
      // Reset form
      setNewListName('');
      setTargetFids([]);
      setRequireMentions([]);
      setFeedSource('specific_users');
      setRequiredUrls([]);
      setRequiredKeywords([]);
      setIsCreatingList(false);

      toast({
        title: 'Success',
        description: 'Auto-interaction list created successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
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

    setIsSaving(true);
    setSaveSuccess(false);

    const result = await updateAutoInteractionSettings(activeList.id, {
      sourceAccountId,
      actionType,
      onlyTopCasts,
      requireMentions: requireMentions.length > 0 ? requireMentions : undefined,
      feedSource,
      requiredUrls: requiredUrls.length > 0 ? requiredUrls : undefined,
      requiredKeywords: requiredKeywords.length > 0 ? requiredKeywords : undefined,
    });

    if (result.success) {
      setSaveSuccess(true);
      toast({
        title: 'Success',
        description: 'Settings updated successfully',
      });

      // Reset success state after 2 seconds
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

  const handleDeleteList = async (listId: string) => {
    const result = await removeList(listId);

    if (result.success) {
      if (activeListId === listId) {
        setActiveListId(null);
      }
      toast({
        title: 'Success',
        description: 'List deleted successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
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
      setFeedSource(content.feedSource || 'specific_users');
      setRequiredUrls(content.requiredUrls || []);
      setRequiredKeywords(content.requiredKeywords || []);
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
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Create Auto-Interaction</DialogTitle>
                        <DialogDescription>
                          Step {currentStep} of 3:{' '}
                          {currentStep === 1
                            ? 'Basic Setup'
                            : currentStep === 2
                              ? 'Content Filters'
                              : 'Action Settings'}
                        </DialogDescription>
                      </DialogHeader>

                      {/* Progress Indicator */}
                      <div className="flex items-center justify-center space-x-2 py-4">
                        <div className={cn('h-2 w-16 rounded-full', currentStep >= 1 ? 'bg-primary' : 'bg-muted')} />
                        <div className={cn('h-2 w-16 rounded-full', currentStep >= 2 ? 'bg-primary' : 'bg-muted')} />
                        <div className={cn('h-2 w-16 rounded-full', currentStep >= 3 ? 'bg-primary' : 'bg-muted')} />
                      </div>

                      <div className="space-y-4 py-4 min-h-[300px]">
                        {/* Step 1: Basic Setup */}
                        {currentStep === 1 && (
                          <div className="space-y-6">
                            <div>
                              <Label htmlFor="name">Automation Name</Label>
                              <Input
                                id="name"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="e.g., Amplify product mentions"
                                className="mt-2"
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Give your automation a descriptive name
                              </p>
                            </div>

                            <div className="space-y-3">
                              <Label>Who to monitor</Label>
                              <RadioGroup
                                value={feedSource}
                                onValueChange={(value) => setFeedSource(value as 'specific_users' | 'following')}
                              >
                                <Label
                                  htmlFor="specific_users_create"
                                  className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                >
                                  <RadioGroupItem value="specific_users" id="specific_users_create" />
                                  <div className="flex-1">
                                    <span className="font-normal">Specific users</span>
                                    <p className="text-sm text-muted-foreground">
                                      Monitor casts from selected accounts only
                                    </p>
                                  </div>
                                </Label>
                                <Label
                                  htmlFor="following_create"
                                  className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                >
                                  <RadioGroupItem value="following" id="following_create" />
                                  <div className="flex-1">
                                    <span className="font-normal">Everyone I follow</span>
                                    <p className="text-sm text-muted-foreground">
                                      Monitor casts from all accounts you follow
                                    </p>
                                  </div>
                                </Label>
                              </RadioGroup>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="source-account-create">Acting Account</Label>
                              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                                <SelectTrigger id="source-account-create">
                                  <SelectValue placeholder="Select an account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account: AccountObjectType) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.name || `Account ${account.id.slice(0, 8)}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-sm text-muted-foreground">
                                This account will automatically like or recast posts
                              </p>
                            </div>

                            {feedSource === 'specific_users' && (
                              <div>
                                <Label>Select accounts to monitor</Label>
                                <ProfileSearchDropdown
                                  defaultProfiles={[]}
                                  selectedProfile={undefined}
                                  setSelectedProfile={handleAddTargetAccount}
                                  placeholder="Search and add accounts"
                                />
                                {targetFids.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {targetFids.length} accounts selected:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {targetFids.map((fid) => {
                                        const profile = getProfileFromBulk(profiles, parseInt(fid));
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
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 2: Content Filters */}
                        {currentStep === 2 && (
                          <div className="space-y-6">
                            <div>
                              <h3 className="font-medium mb-2">Content Filters</h3>
                              <p className="text-sm text-muted-foreground">
                                Define what content should trigger automatic interactions (optional)
                              </p>
                            </div>

                            <AutoInteractionContentFilters
                              feedSource={feedSource}
                              requiredUrls={requiredUrls}
                              requiredKeywords={requiredKeywords}
                              onFeedSourceChange={() => {}}
                              onRequiredUrlsChange={setRequiredUrls}
                              onRequiredKeywordsChange={setRequiredKeywords}
                              hideSpecificUsers={true}
                            />

                            <div className="space-y-2">
                              <Label>Require mentions (optional)</Label>
                              <ProfileSearchDropdown
                                defaultProfiles={[]}
                                selectedProfile={undefined}
                                setSelectedProfile={(profile) => {
                                  if (profile && !requireMentions.includes(profile.fid.toString())) {
                                    setRequireMentions([...requireMentions, profile.fid.toString()]);
                                  }
                                }}
                                placeholder="Add required mentions"
                              />
                              {requireMentions.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {requireMentions.map((fid) => {
                                    const profile = getProfileFromBulk(profiles, parseInt(fid));
                                    return (
                                      <Badge key={fid} variant="secondary">
                                        @{profile?.username || `fid:${fid}`}
                                        <button
                                          onClick={() => setRequireMentions(requireMentions.filter((f) => f !== fid))}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          ×
                                        </button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Only interact if these accounts are mentioned in the cast
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="only-top-casts-create">Only interact with top-level casts</Label>
                                <Switch
                                  id="only-top-casts-create"
                                  checked={onlyTopCasts}
                                  onCheckedChange={setOnlyTopCasts}
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">When enabled, replies will be ignored</p>
                            </div>
                          </div>
                        )}

                        {/* Step 3: Action Settings */}
                        {currentStep === 3 && (
                          <div className="space-y-6">
                            <div>
                              <h3 className="font-medium mb-2">Action Settings</h3>
                              <p className="text-sm text-muted-foreground">
                                Configure how to interact with matching content
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Action Type</Label>
                              <RadioGroup
                                value={actionType}
                                onValueChange={(value) => setActionType(value as 'like' | 'recast' | 'both')}
                              >
                                <Label htmlFor="like-create" className="flex items-center space-x-2 cursor-pointer">
                                  <RadioGroupItem value="like" id="like-create" />
                                  <span className="font-normal">Like only</span>
                                </Label>
                                <Label htmlFor="recast-create" className="flex items-center space-x-2 cursor-pointer">
                                  <RadioGroupItem value="recast" id="recast-create" />
                                  <span className="font-normal">Recast only</span>
                                </Label>
                                <Label htmlFor="both-create" className="flex items-center space-x-2 cursor-pointer">
                                  <RadioGroupItem value="both" id="both-create" />
                                  <span className="font-normal">Like and recast</span>
                                </Label>
                              </RadioGroup>
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter className="flex justify-between">
                        <div>
                          {currentStep > 1 && (
                            <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>
                              Previous
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsCreatingList(false);
                              setCurrentStep(1);
                              // Reset form
                              setNewListName('');
                              setTargetFids([]);
                              setRequireMentions([]);
                              setFeedSource('specific_users');
                              setRequiredUrls([]);
                              setRequiredKeywords([]);
                            }}
                          >
                            Cancel
                          </Button>
                          {currentStep < 3 ? (
                            <Button
                              onClick={() => {
                                // Validate current step
                                if (currentStep === 1) {
                                  if (!newListName.trim()) {
                                    toast({
                                      title: 'Error',
                                      description: 'Please provide a name',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  if (!sourceAccountId) {
                                    toast({
                                      title: 'Error',
                                      description: 'Please select an acting account',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  if (feedSource === 'specific_users' && targetFids.length === 0) {
                                    toast({
                                      title: 'Error',
                                      description: 'Please add at least one account to monitor',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                }
                                if (currentStep === 2) {
                                  // No validation needed for filters (all optional)
                                }
                                setCurrentStep(currentStep + 1);
                              }}
                            >
                              Next
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                handleCreateList();
                                setCurrentStep(1);
                              }}
                            >
                              Create Automation
                            </Button>
                          )}
                        </div>
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
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteList(activeList.id)}>
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="sources">
                    <TabsList>
                      <TabsTrigger value="sources">Sources</TabsTrigger>
                      <TabsTrigger value="filters">Filters</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sources" className="mt-4">
                      <div className="space-y-6">
                        {/* Feed Source Selection */}
                        <div className="space-y-2">
                          <Label>Who to monitor</Label>
                          <RadioGroup
                            value={feedSource}
                            onValueChange={(value) => setFeedSource(value as 'specific_users' | 'following')}
                          >
                            <Label htmlFor="specific_users_tab" className="flex items-center space-x-2 cursor-pointer">
                              <RadioGroupItem value="specific_users" id="specific_users_tab" />
                              <span className="font-normal">Specific users</span>
                            </Label>
                            <Label htmlFor="following_tab" className="flex items-center space-x-2 cursor-pointer">
                              <RadioGroupItem value="following" id="following_tab" />
                              <span className="font-normal">Everyone I follow</span>
                            </Label>
                          </RadioGroup>
                          <p className="text-sm text-muted-foreground">
                            {feedSource === 'specific_users'
                              ? 'Monitor casts from specific accounts only'
                              : 'Monitor casts from all accounts you follow'}
                          </p>
                        </div>

                        {/* User List Management - Only show for specific users */}
                        {feedSource === 'specific_users' && (
                          <div className="space-y-4">
                            <div>
                              <Label className="mb-2 block">Accounts to monitor</Label>
                              <div className="flex items-center gap-2">
                                <ProfileSearchDropdown
                                  defaultProfiles={[]}
                                  selectedProfile={selectedProfile}
                                  setSelectedProfile={async (profile) => {
                                    if (profile) {
                                      const result = await addFidToList(
                                        activeList.id,
                                        profile.fid.toString(),
                                        profile.username
                                      );
                                      if (!result.success) {
                                        toast({
                                          title: 'Error',
                                          description: result.error,
                                          variant: 'destructive',
                                        });
                                      }
                                      setSelectedProfile(undefined);
                                    }
                                  }}
                                  placeholder="Add account to monitor"
                                />
                              </div>
                            </div>

                            <div className="border rounded-lg">
                              {(activeList.contents as AutoInteractionListContent).fids.length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground">
                                  No accounts added yet. Add accounts to monitor their casts.
                                </div>
                              ) : (
                                (activeList.contents as AutoInteractionListContent).fids.map((fid) => (
                                  <div
                                    key={fid}
                                    className="flex items-center justify-between p-3 border-b last:border-b-0"
                                  >
                                    <ProfileInfo fid={parseInt(fid)} viewerFid={viewerFid} compact={true} />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        const result = await removeFidFromList(activeList.id as UUID, fid);
                                        if (!result.success) {
                                          toast({
                                            title: 'Error',
                                            description: result.error,
                                            variant: 'destructive',
                                          });
                                        }
                                      }}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Following Feed Info */}
                        {feedSource === 'following' && (
                          <div className="border rounded-lg p-6 bg-muted/50">
                            <p className="text-sm text-muted-foreground">
                              This automation will monitor casts from all accounts you follow.
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="filters" className="mt-4">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-4">Content Filters</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Define what content should trigger automatic interactions
                          </p>
                        </div>

                        <AutoInteractionContentFilters
                          feedSource={feedSource}
                          requiredUrls={requiredUrls}
                          requiredKeywords={requiredKeywords}
                          onFeedSourceChange={() => {}} // Disabled here, controlled in Sources tab
                          onRequiredUrlsChange={setRequiredUrls}
                          onRequiredKeywordsChange={setRequiredKeywords}
                          hideSpecificUsers={true} // Hide feed source selector
                        />

                        <div className="space-y-2">
                          <Label>Require mentions (optional)</Label>
                          <ProfileSearchDropdown
                            defaultProfiles={[]}
                            selectedProfile={undefined}
                            setSelectedProfile={(profile: User) => {
                              if (!requireMentions.includes(profile.fid.toString())) {
                                setRequireMentions([...requireMentions, profile.fid.toString()]);
                              }
                            }}
                            placeholder="Add accounts that must be mentioned"
                          />
                          {requireMentions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Only interact if these accounts are mentioned:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {requireMentions.map((fid) => (
                                  <div
                                    key={fid}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-secondary rounded-md"
                                  >
                                    <ProfileInfo fid={parseInt(fid)} viewerFid={viewerFid} compact={true} />
                                    <button
                                      onClick={() => setRequireMentions(requireMentions.filter((f) => f !== fid))}
                                      className="ml-1 text-muted-foreground hover:text-foreground"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="only-top-casts">Only interact with top-level casts</Label>
                            <Switch id="only-top-casts" checked={onlyTopCasts} onCheckedChange={setOnlyTopCasts} />
                          </div>
                          <p className="text-sm text-muted-foreground">When enabled, replies will be ignored</p>
                        </div>

                        <div className="mt-6">
                          <Button onClick={handleUpdateSettings} disabled={isSaving} className="min-w-[120px]">
                            {isSaving ? (
                              'Saving...'
                            ) : saveSuccess ? (
                              <>
                                <CheckIcon className="w-4 h-4 mr-2" />
                                Saved
                              </>
                            ) : (
                              'Save Filters'
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="actions" className="mt-4">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-medium mb-4">Action Settings</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Configure how to interact with matching content
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="source-account">Acting Account</Label>
                          <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger id="source-account">
                              <SelectValue placeholder="Select an account to perform actions" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account: AccountObjectType) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name || `Account ${account.id.slice(0, 8)}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">
                            This account will automatically like or recast posts
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Action Type</Label>
                          <RadioGroup
                            value={actionType}
                            onValueChange={(value) => setActionType(value as 'like' | 'recast' | 'both')}
                          >
                            <Label htmlFor="like" className="flex items-center space-x-2 cursor-pointer">
                              <RadioGroupItem value="like" id="like" />
                              <span className="font-normal">Like only</span>
                            </Label>
                            <Label htmlFor="recast" className="flex items-center space-x-2 cursor-pointer">
                              <RadioGroupItem value="recast" id="recast" />
                              <span className="font-normal">Recast only</span>
                            </Label>
                            <Label htmlFor="both" className="flex items-center space-x-2 cursor-pointer">
                              <RadioGroupItem value="both" id="both" />
                              <span className="font-normal">Like and recast</span>
                            </Label>
                          </RadioGroup>
                        </div>

                        <div className="mt-6">
                          <Button onClick={handleUpdateSettings} disabled={isSaving} className="min-w-[120px]">
                            {isSaving ? (
                              'Saving...'
                            ) : saveSuccess ? (
                              <>
                                <CheckIcon className="w-4 h-4 mr-2" />
                                Saved
                              </>
                            ) : (
                              'Save Actions'
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                      <AutoInteractionHistory listId={activeList.id} />
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
