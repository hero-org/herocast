'use client';

import { Radio } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useSpacesStore } from '@/stores/useSpacesStore';

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 280;

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Host-create flow: collect a title + optional description, then call
 * `createSpace`. The store handles minting/joining as host; on success we
 * close the dialog (the persistent bar takes over).
 */
export const CreateSpaceDialog: React.FC<CreateSpaceDialogProps> = ({ open, onOpenChange }) => {
  const createSpace = useSpacesStore((s) => s.createSpace);
  const join = useSpacesStore((s) => s.join);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && !submitting;

  const reset = () => {
    setTitle('');
    setDescription('');
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const room = await createSpace({ title: title.trim(), description: description.trim() || undefined });
      if (!room) {
        // No writable account / create failed without throwing — stay open.
        toast.error('Could not start space');
        setSubmitting(false);
        return;
      }
      // Enter our own room as host; the persistent bar takes over from here.
      await join(room.id);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Could not start space');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive" />
            Start a space
          </DialogTitle>
          <DialogDescription>
            Go live with a public audio room. Anyone on Farcaster can join and listen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="space-title" className="font-medium">
              Title
            </Label>
            <Input
              id="space-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
              placeholder="What's this space about?"
              autoFocus
              disabled={submitting}
              variantSize="lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="space-description" className="font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="space-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="Add context for listeners"
              rows={3}
              disabled={submitting}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Spinner size="sm" />
                  Starting
                </>
              ) : (
                'Go live'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
