'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { MAX_FID_LIST_SIZE, MAX_FID_LIST_SIZE_MESSAGE } from '@/common/constants/listLimits';
import type { FarcasterUser } from '@/common/types/farcaster';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getProvider } from '@/lib/farcaster/providers';

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
  user?: FarcasterUser;
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
    setProcessingProgress({ current: 0, total: 0 });
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

    const results: ParsedUser[] = [];
    setProcessingProgress({ current: 0, total: items.length });

    // Separate FIDs and usernames
    const fidItems: { input: string; fid: string }[] = [];
    const usernameItems: string[] = [];

    items.forEach((item) => {
      if (/^\d+$/.test(item)) {
        fidItems.push({ input: item, fid: item });
      } else {
        usernameItems.push(item);
      }
    });

    // Process FIDs in batches using bulk API
    const fidBatchSize = 50; // API supports up to 100, using 50 to be safe
    for (let i = 0; i < fidItems.length; i += fidBatchSize) {
      const batch = fidItems.slice(i, i + fidBatchSize);

      // First, handle duplicates
      const duplicates = batch.filter((item) => existingFids.includes(item.fid));
      duplicates.forEach((item) => {
        results.push({ input: item.input, fid: item.fid, isDuplicate: true });
      });

      // Get non-duplicate FIDs to fetch
      const fidsToFetch = batch.filter((item) => !existingFids.includes(item.fid)).map((item) => item.fid);

      if (fidsToFetch.length > 0) {
        try {
          // Fetch profiles in bulk via the Farcaster provider abstraction
          const users = await getProvider().getBulkUsers({
            fids: fidsToFetch.map((fid) => Number(fid)),
            viewerFid: Number(viewerFid),
          });

          // Add fetched users to results
          users.forEach((user: FarcasterUser) => {
            const fidItem = batch.find((item) => parseInt(item.fid) === user.fid)!;
            results.push({
              input: fidItem.input,
              fid: user.fid.toString(),
              user,
              isDuplicate: false,
            });
          });

          // Handle not found FIDs
          const foundFids = new Set(users.map((u: FarcasterUser) => u.fid));
          fidsToFetch.forEach((fid) => {
            if (!foundFids.has(parseInt(fid))) {
              const fidItem = batch.find((item) => item.fid === fid)!;
              results.push({
                input: fidItem.input,
                error: 'User not found',
              });
            }
          });
        } catch (error) {
          console.error('Error processing FID batch:', error);
          batch.forEach((item) => {
            if (!existingFids.includes(item.fid)) {
              results.push({ input: item.input, error: 'Failed to fetch user' });
            }
          });
        }
      }

      setProcessingProgress({ current: i + batch.length, total: items.length });

      // Add delay between batches to avoid rate limiting
      if (i + fidBatchSize < fidItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Process usernames one by one with rate limiting
    const usernameDelay = 150; // 150ms between requests to stay well under rate limit
    for (let i = 0; i < usernameItems.length; i++) {
      const username = usernameItems[i];

      try {
        // Search for username via the Farcaster provider abstraction
        const matches = await getProvider().searchUsers({
          q: username,
          viewerFid: Number(viewerFid),
          limit: 1,
        });

        if (matches.length > 0) {
          const user = matches[0];
          const fid = user.fid.toString();

          results.push({
            input: username,
            fid,
            user,
            isDuplicate: existingFids.includes(fid),
          });
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

    // Hypersnap's FID-list feed hard-caps at 100, so never let an import push past it.
    if (availableSlots <= 0) {
      toast({
        title: 'List is full',
        description: MAX_FID_LIST_SIZE_MESSAGE,
        variant: 'destructive',
      });
      return;
    }

    // Clip the import to the remaining slots and tell the user what was skipped.
    const usersToAddSource = validUsers.slice(0, availableSlots);
    const skippedCount = validUsers.length - usersToAddSource.length;

    setIsProcessing(true);
    setLastAddError(null);

    try {
      const usersToAdd = usersToAddSource.map((u) => ({
        fid: u.fid!,
        displayName: u.user!.username,
      }));

      const result = await onAddUsers(usersToAdd);

      if (result.success) {
        toast({
          title: 'Success',
          description:
            skippedCount > 0
              ? `Added ${usersToAdd.length} users. Skipped ${skippedCount} — ${MAX_FID_LIST_SIZE_MESSAGE.toLowerCase()}.`
              : `Added ${usersToAdd.length} users to the list`,
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
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
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

  // Hypersnap's FID-list feed hard-caps at 100, so clip imports to the remaining slots.
  const availableSlots = Math.max(0, MAX_FID_LIST_SIZE - existingFids.length);
  const addableCount = Math.min(validCount, availableSlots);
  const overflowCount = Math.max(0, validCount - availableSlots);

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
                {parsedUsers.map((parsedUser) => (
                  <div
                    key={`${parsedUser.input}-${parsedUser.fid || 'pending'}`}
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

            {addableCount > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to add {addableCount} user{addableCount !== 1 ? 's' : ''} to the list
                </AlertDescription>
              </Alert>
            )}

            {overflowCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {MAX_FID_LIST_SIZE_MESSAGE}. This list has {existingFids.length}, so{' '}
                  {availableSlots > 0 ? (
                    <>
                      only the first {availableSlots} will be added and {overflowCount} will be skipped.
                    </>
                  ) : (
                    <>the list is full and no users can be added.</>
                  )}
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
              <Button onClick={handleAddUsers} disabled={isProcessing || addableCount === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : lastAddError ? (
                  `Retry Adding ${addableCount} User${addableCount !== 1 ? 's' : ''}`
                ) : (
                  `Add ${addableCount} User${addableCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
