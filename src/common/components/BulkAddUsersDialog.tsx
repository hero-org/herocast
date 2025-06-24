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

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (item): Promise<ParsedUser> => {
          // Check if it's a number (FID)
          const isNumeric = /^\d+$/.test(item);

          try {
            if (isNumeric) {
              // It's an FID
              const fid = item;

              // Check if already in list
              if (existingFids.includes(fid)) {
                return { input: item, fid, isDuplicate: true };
              }

              // Fetch user data
              const response = await neynarClient.fetchBulkUsers([parseInt(fid)], {
                viewerFid: parseInt(viewerFid),
              });

              if (response.users && response.users.length > 0) {
                return { input: item, fid, user: response.users[0] };
              } else {
                return { input: item, error: 'User not found' };
              }
            } else {
              // It's a username - search for it
              const response = await neynarClient.searchUser(item, parseInt(viewerFid));

              if (response.result?.users && response.result.users.length > 0) {
                const user = response.result.users[0];
                const fid = user.fid.toString();

                // Check if already in list
                if (existingFids.includes(fid)) {
                  return { input: item, fid, user, isDuplicate: true };
                }

                return { input: item, fid, user };
              } else {
                return { input: item, error: 'User not found' };
              }
            }
          } catch (error) {
            console.error(`Error processing ${item}:`, error);
            return { input: item, error: 'Failed to fetch user' };
          }
        })
      );

      results.push(...batchResults);
    }

    setParsedUsers(results);
    setShowPreview(true);
    setIsProcessing(false);
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
