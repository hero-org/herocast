'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getProfile } from '@/common/helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import { fetchAndAddUserProfile } from '@/common/helpers/profileUtils';

interface BulkAddUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddUsers: (users: Array<{ fid: string; displayName: string }>) => Promise<void>;
  existingFids: string[];
  viewerFid: string;
}

interface ParsedUser {
  input: string;
  fid?: string;
  user?: User;
  error?: string;
  isDuplicate?: boolean;
}

export function BulkAddUsersDialog({
  open,
  onOpenChange,
  onAddUsers,
  existingFids,
  viewerFid,
}: BulkAddUsersDialogProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const resetDialog = () => {
    setInput('');
    setParsedUsers([]);
    setShowPreview(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const parseInput = (text: string): string[] => {
    // Split by commas, newlines, or spaces
    const items = text
      .split(/[,\n\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Remove duplicates
    return [...new Set(items)];
  };

  const processUsers = async () => {
    if (!input.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some FIDs or usernames',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const items = parseInput(input);
    const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

    const results: ParsedUser[] = [];
    setProcessingProgress({ current: 0, total: items.length });

    // Separate FIDs and usernames
    const fidItems: { input: string; fid: string }[] = [];
    const usernameItems: string[] = [];
    
    items.forEach(item => {
      if (/^\d+$/.test(item)) {
        fidItems.push({ input: item, fid: item });
      } else {
        usernameItems.push(item);
      }
    });

    // Process FIDs in batches using bulk API
    const fidBatchSize = 50; // Neynar bulk API supports up to 100, using 50 to be safe
    for (let i = 0; i < fidItems.length; i += fidBatchSize) {
      const batch = fidItems.slice(i, i + fidBatchSize);
      
      // First, handle duplicates
      const duplicates = batch.filter(item => existingFids.includes(item.fid));
      duplicates.forEach(item => {
        results.push({ input: item.input, fid: item.fid, isDuplicate: true });
      });
      
      // Get non-duplicate FIDs to fetch
      const fidsToFetch = batch
        .filter(item => !existingFids.includes(item.fid))
        .map(item => parseInt(item.fid));
      
      if (fidsToFetch.length > 0) {
        try {
          // Check cache first
          const cachedResults: ParsedUser[] = [];
          const uncachedFids: number[] = [];
          
          fidsToFetch.forEach(fid => {
            const cachedProfile = getProfile(useDataStore.getState(), fid);
            if (cachedProfile) {
              const fidItem = batch.find(item => parseInt(item.fid) === fid)!;
              cachedResults.push({
                input: fidItem.input,
                fid: fid.toString(),
                user: cachedProfile as User,
                isDuplicate: false
              });
            } else {
              uncachedFids.push(fid);
            }
          });
          
          results.push(...cachedResults);
          
          // Fetch uncached profiles in bulk
          if (uncachedFids.length > 0) {
            const response = await neynarClient.fetchBulkUsers(uncachedFids, {
              viewerFid: parseInt(viewerFid),
            });
            
            if (response.users) {
              // Add fetched users to results and cache
              response.users.forEach(user => {
                const fidItem = batch.find(item => parseInt(item.fid) === user.fid)!;
                results.push({
                  input: fidItem.input,
                  fid: user.fid.toString(),
                  user,
                  isDuplicate: false
                });
                // Add to cache - skip additional info for bulk operations
                fetchAndAddUserProfile({ fid: user.fid, viewerFid: parseInt(viewerFid), skipAdditionalInfo: true });
              });
              
              // Handle not found FIDs
              const foundFids = new Set(response.users.map(u => u.fid));
              uncachedFids.forEach(fid => {
                if (!foundFids.has(fid)) {
                  const fidItem = batch.find(item => parseInt(item.fid) === fid)!;
                  results.push({
                    input: fidItem.input,
                    error: 'User not found'
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('Error processing FID batch:', error);
          batch.forEach(item => {
            if (!existingFids.includes(item.fid)) {
              results.push({ input: item.input, error: 'Failed to fetch user' });
            }
          });
        }
      }
      
      setProcessingProgress({ current: i + batch.length, total: items.length });
      
      // Add delay between batches to avoid rate limiting
      if (i + fidBatchSize < fidItems.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Process usernames one by one with rate limiting
    const usernameDelay = 150; // 150ms between requests to stay well under rate limit
    for (let i = 0; i < usernameItems.length; i++) {
      const username = usernameItems[i];
      
      try {
        // Check cache first by username
        const cachedFid = useDataStore.getState().usernameToFid[username.toLowerCase()];
        if (cachedFid) {
          const cachedProfile = getProfile(useDataStore.getState(), cachedFid);
          if (cachedProfile) {
            results.push({
              input: username,
              fid: cachedFid.toString(),
              user: cachedProfile as User,
              isDuplicate: existingFids.includes(cachedFid.toString())
            });
            setProcessingProgress({ current: fidItems.length + i + 1, total: items.length });
            continue;
          }
        }
        
        // Search for username
        const response = await neynarClient.searchUser(username, parseInt(viewerFid));
        
        if (response.result?.users && response.result.users.length > 0) {
          const user = response.result.users[0];
          const fid = user.fid.toString();
          
          results.push({
            input: username,
            fid,
            user,
            isDuplicate: existingFids.includes(fid)
          });
          
          // Add to cache - skip additional info for bulk operations
          fetchAndAddUserProfile({ fid: user.fid, viewerFid: parseInt(viewerFid), skipAdditionalInfo: true });
        } else {
          results.push({ input: username, error: 'User not found' });
        }
      } catch (error) {
        console.error(`Error processing username ${username}:`, error);
        results.push({ input: username, error: 'Failed to fetch user' });
      }
      
      setProcessingProgress({ current: fidItems.length + i + 1, total: items.length });
      
      // Rate limit delay between username searches
      if (i < usernameItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, usernameDelay));
      }
    }

    setParsedUsers(results);
    setShowPreview(true);
    setIsProcessing(false);
    setProcessingProgress({ current: 0, total: 0 });
  };

  const handleAddUsers = async () => {
    const validUsers = parsedUsers.filter((u) => u.user && !u.isDuplicate);

    if (validUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid users to add',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const usersToAdd = validUsers.map((u) => ({
        fid: u.fid!,
        displayName: u.user!.username,
      }));

      await onAddUsers(usersToAdd);

      toast({
        title: 'Success',
        description: `Added ${usersToAdd.length} users to the list`,
      });

      handleClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add users: ${error.message}`,
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const validCount = parsedUsers.filter((u) => u.user && !u.isDuplicate).length;
  const duplicateCount = parsedUsers.filter((u) => u.isDuplicate).length;
  const errorCount = parsedUsers.filter((u) => u.error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Add Users</DialogTitle>
          <DialogDescription>Add multiple users to your list by entering FIDs or usernames</DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-input">Enter FIDs or usernames</Label>
              <Textarea
                id="bulk-input"
                placeholder="Enter FIDs or usernames separated by commas, spaces, or new lines&#10;&#10;Examples:&#10;3, 5, 8&#10;dwr.eth, vitalik.eth&#10;1234 5678 9012"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[200px] mt-2 font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground mt-2">
                You can mix FIDs and usernames. Duplicates will be automatically removed.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {validCount} valid
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {duplicateCount} duplicate
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorCount} error
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-2">
                {parsedUsers.map((parsedUser, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded-md text-sm ${
                      parsedUser.error
                        ? 'bg-destructive/10 text-destructive'
                        : parsedUser.isDuplicate
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{parsedUser.input}</span>
                      {parsedUser.user && (
                        <span className="text-muted-foreground">
                          → @{parsedUser.user.username} (FID: {parsedUser.fid})
                        </span>
                      )}
                    </div>
                    <div>
                      {parsedUser.error && <span className="text-xs">{parsedUser.error}</span>}
                      {parsedUser.isDuplicate && <span className="text-xs">Already in list</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {validCount > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to add {validCount} user{validCount !== 1 ? 's' : ''} to the list
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          {!showPreview ? (
            <Button onClick={processUsers} disabled={isProcessing || !input.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Preview'
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isProcessing}>
                Back
              </Button>
              <Button onClick={handleAddUsers} disabled={isProcessing || validCount === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${validCount} User${validCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
