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
  onAddUsers: (users: Array<{ fid: string; displayName: string }>) => Promise<{ success: boolean; error?: string }>;
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
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [lastAddError, setLastAddError] = useState<string | null>(null);

  const resetDialog = () => {
    setInput('');
    setParsedUsers([]);
    setShowPreview(false);
    setIsProcessing(false);
    setLastAddError(null);
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
    const fids: string[] = [];
    const usernames: string[] = [];

    items.forEach((item) => {
      if (/^\d+$/.test(item)) {
        fids.push(item);
      } else {
        usernames.push(item);
      }
    });

    // Process FIDs in batches using bulk API
    const fidBatchSize = 50; // Neynar bulk API supports up to 100, using 50 to be safe
    for (let i = 0; i < fids.length; i += fidBatchSize) {
      const batch = fids.slice(i, i + fidBatchSize);
      const batchFids = batch.map((fid) => parseInt(fid));

      try {
        // First check cache for existing profiles
        const cachedResults: ParsedUser[] = [];
        const uncachedFids: number[] = [];

        for (const fid of batchFids) {
          const cachedProfile = getProfile(useDataStore.getState(), fid);
          if (cachedProfile) {
            cachedResults.push({
              input: fid.toString(),
              fid: fid.toString(),
              user: cachedProfile as User,
              isDuplicate: existingFids.includes(fid.toString()),
            });
          } else {
            uncachedFids.push(fid);
          }
        }

        results.push(...cachedResults);

        // Fetch uncached profiles in bulk
        if (uncachedFids.length > 0) {
          const response = await neynarClient.fetchBulkUsers(uncachedFids, {
            viewerFid: parseInt(viewerFid),
          });

          if (response.users) {
            response.users.forEach((user) => {
              const fidStr = user.fid.toString();
              results.push({
                input: fidStr,
                fid: fidStr,
                user,
                isDuplicate: existingFids.includes(fidStr),
              });
              // Add to cache
              fetchAndAddUserProfile({ fid: user.fid, viewerFid: parseInt(viewerFid) });
            });

            // Handle not found FIDs
            const foundFids = new Set(response.users.map((u) => u.fid.toString()));
            uncachedFids.forEach((fid) => {
              if (!foundFids.has(fid.toString())) {
                results.push({
                  input: fid.toString(),
                  error: 'User not found',
                });
              }
            });
          }
        }

        setProcessingProgress({ current: i + batch.length, total: items.length });

        // Add delay between batches to avoid rate limiting
        if (i + fidBatchSize < fids.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error processing FID batch:', error);
        batch.forEach((fid) => {
          results.push({ input: fid, error: 'Failed to fetch user' });
        });
      }
    }

    // Process usernames one by one with rate limiting
    const usernameDelay = 150; // 150ms between requests to stay well under rate limit
    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];

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
              isDuplicate: existingFids.includes(cachedFid.toString()),
            });
            setProcessingProgress({ current: fids.length + i + 1, total: items.length });
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
            isDuplicate: existingFids.includes(fid),
          });

          // Add to cache
          fetchAndAddUserProfile({ fid: user.fid, viewerFid: parseInt(viewerFid) });
        } else {
          results.push({ input: username, error: 'User not found' });
        }
      } catch (error) {
        console.error(`Error processing username ${username}:`, error);
        results.push({ input: username, error: 'Failed to fetch user' });
      }

      setProcessingProgress({ current: fids.length + i + 1, total: items.length });

      // Rate limit delay between username searches
      if (i < usernames.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, usernameDelay));
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
    setLastAddError(null);

    try {
      const usersToAdd = validUsers.map((u) => ({
        fid: u.fid!,
        displayName: u.user!.username,
      }));

      const result = await onAddUsers(usersToAdd);

      if (result.success) {
        toast({
          title: 'Success',
          description: `Added ${usersToAdd.length} users to the list`,
        });
        handleClose();
      } else {
        // Keep the dialog open for retry
        setLastAddError(result.error || 'Failed to add users to the list');
        toast({
          title: 'Error',
          description: result.error || 'Failed to add users. You can retry without re-fetching.',
          variant: 'destructive',
        });
        setIsProcessing(false);
      }
    } catch (error) {
      // Keep the dialog open for retry
      const errorMessage = error.message || 'An unexpected error occurred';
      setLastAddError(errorMessage);
      toast({
        title: 'Error',
        description: `Failed to add users: ${errorMessage}`,
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
            
            {lastAddError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {lastAddError}
                  <br />
                  <span className="text-xs mt-1">You can retry without re-fetching the data.</span>
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
                  Processing
                  {processingProgress.total > 0 && ` (${processingProgress.current}/${processingProgress.total})`}...
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
                  lastAddError ? `Retry Adding ${validCount} User${validCount !== 1 ? 's' : ''}` : `Add ${validCount} User${validCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
