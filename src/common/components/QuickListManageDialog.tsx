'use client';

import { Loader2, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MAX_USERS_PER_LIST } from '@/common/constants/listLimits';
import { isFidListContent } from '@/common/types/list.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useListStore } from '@/stores/useListStore';

interface QuickListManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorFid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
}

export function QuickListManageDialog({
  open,
  onOpenChange,
  authorFid,
  authorUsername,
  authorDisplayName,
  authorAvatar,
}: QuickListManageDialogProps) {
  const { toast } = useToast();
  const { lists, getListsByFid, addFidToList, removeFidFromList } = useListStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userLists, setUserLists] = useState<Set<string>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  // Filter to only show FID lists
  const fidLists = useMemo(() => lists.filter((list) => list.type === 'fids'), [lists]);

  // Load current list memberships
  useEffect(() => {
    if (open && authorFid) {
      setIsLoading(true);
      const listsContainingUser = getListsByFid(authorFid);
      setUserLists(new Set(listsContainingUser.map((list) => list.id)));
      setPendingChanges(new Map());
      setIsLoading(false);
    }
  }, [open, authorFid, getListsByFid]);

  // Calculate which lists are at capacity
  const listsAtCapacity = useMemo(() => {
    const atCapacity = new Set<string>();
    fidLists.forEach((list) => {
      if (isFidListContent(list.contents) && list.contents.fids.length >= MAX_USERS_PER_LIST) {
        atCapacity.add(list.id);
      }
    });
    return atCapacity;
  }, [fidLists]);

  const handleToggleList = (listId: string, checked: boolean) => {
    setPendingChanges((prev) => new Map(prev).set(listId, checked));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const errors: string[] = [];

    // Process all pending changes
    for (const [listId, shouldBeInList] of pendingChanges.entries()) {
      const isCurrentlyInList = userLists.has(listId);

      if (shouldBeInList && !isCurrentlyInList) {
        // Add to list
        const result = await addFidToList(listId, authorFid, authorDisplayName);
        if (!result.success) {
          const list = fidLists.find((l) => l.id === listId);
          errors.push(`Failed to add to "${list?.name || 'list'}": ${result.error}`);
        }
      } else if (!shouldBeInList && isCurrentlyInList) {
        // Remove from list
        const result = await removeFidFromList(listId, authorFid);
        if (!result.success) {
          const list = fidLists.find((l) => l.id === listId);
          errors.push(`Failed to remove from "${list?.name || 'list'}": ${result.error}`);
        }
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Some changes failed',
        description: errors.join(', '),
        variant: 'destructive',
      });
    } else if (pendingChanges.size > 0) {
      toast({
        title: 'Lists updated',
        description: `Successfully updated list memberships for @${authorUsername}`,
      });
    }

    onOpenChange(false);
    setIsSaving(false);
  };

  const isChecked = (listId: string) => {
    return pendingChanges.has(listId) ? pendingChanges.get(listId)! : userLists.has(listId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Lists</DialogTitle>
          <DialogDescription>Add or remove @{authorUsername} from your lists</DialogDescription>
        </DialogHeader>

        {/* Author info */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <Avatar className="h-10 w-10">
            <AvatarImage src={authorAvatar} alt={authorDisplayName} />
            <AvatarFallback>{authorDisplayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{authorDisplayName}</p>
            <p className="text-sm text-muted-foreground">@{authorUsername}</p>
          </div>
        </div>

        {/* List checkboxes */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : fidLists.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No lists created yet</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/lists">Create your first list</Link>
              </Button>
            </div>
          ) : (
            fidLists.map((list) => {
              const isAtCapacity = listsAtCapacity.has(list.id);
              const isDisabled = isAtCapacity && !isChecked(list.id);
              const userCount = isFidListContent(list.contents) ? list.contents.fids.length : 0;

              return (
                <div key={list.id} className="flex items-center space-x-3 py-2">
                  <Checkbox
                    id={list.id}
                    checked={isChecked(list.id)}
                    onCheckedChange={(checked) => handleToggleList(list.id, checked as boolean)}
                    disabled={isSaving || isDisabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={list.id}
                      className={`flex items-center text-sm font-medium cursor-pointer ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-foreground/80'
                      }`}
                    >
                      <span>{list.name}</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        {userCount} {userCount === 1 ? 'user' : 'users'}
                      </span>
                    </Label>
                    {isAtCapacity && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-orange-500">List at capacity</p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This list has reached the maximum of {MAX_USERS_PER_LIST} users</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || pendingChanges.size === 0}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
