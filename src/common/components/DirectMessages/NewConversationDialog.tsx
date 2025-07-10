import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageInput } from './MessageInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, AlertCircle, User } from 'lucide-react';
import { User as NeynarUser } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { InlineUserSearch } from './InlineUserSearch';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartConversation: (recipientFid: number, message: string) => Promise<void>;
  viewerFid?: string;
  isLoading?: boolean;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onStartConversation,
  viewerFid,
  isLoading = false,
}: NewConversationDialogProps) {
  const [selectedUser, setSelectedUser] = useState<NeynarUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUserSelect = useCallback((user: NeynarUser) => {
    setSelectedUser(user);
    setError(null);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!selectedUser) {
        setError('Please select a user first');
        return;
      }

      try {
        setError(null);
        await onStartConversation(selectedUser.fid, message);
        // Close dialog on success
        onOpenChange(false);
        // Reset state
        setSelectedUser(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start conversation');
      }
    },
    [selectedUser, onStartConversation, onOpenChange]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state when closing
    setSelectedUser(null);
    setError(null);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user-search">To</Label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedUser.pfp_url} alt={selectedUser.display_name} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{selectedUser.display_name}</span>
                    <span className="text-sm text-muted-foreground ml-2">@{selectedUser.username}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <InlineUserSearch
                onSelect={handleUserSelect}
                placeholder="Search for a user..."
                viewerFid={viewerFid}
                autoFocus={true}
              />
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Message Input */}
          {selectedUser && (
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <MessageInput
                onSend={handleSendMessage}
                disabled={isLoading}
                isLoading={isLoading}
                placeholder={`Send a message to ${selectedUser.display_name}...`}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
