'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useDraftStore } from '@/stores/useDraftStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { Button } from '@/components/ui/button';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { MAX_THREAD_POSTS, DraftType } from '@/common/constants/farcaster';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ThreadPostCard from './ThreadPostCard';
import { toast } from 'sonner';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import HotkeyTooltipWrapper from '@/common/components/HotkeyTooltipWrapper';
import { CastRow } from '@/common/components/CastRow';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { useCloudinaryUpload } from '@/common/hooks/useCloudinaryUpload';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

const MAX_POST_LENGTH = 320;

/**
 * Split text into thread posts intelligently
 * - Split on double newlines first (paragraph breaks)
 * - Then split long paragraphs at word boundaries near MAX_POST_LENGTH
 */
function splitTextIntoPosts(text: string): string[] {
  const posts: string[] = [];

  // First split on double newlines (paragraph breaks)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (trimmed.length <= MAX_POST_LENGTH) {
      posts.push(trimmed);
    } else {
      // Split long paragraph at word boundaries
      let remaining = trimmed;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_POST_LENGTH) {
          posts.push(remaining);
          break;
        }

        // Find last space before MAX_POST_LENGTH
        let splitPoint = remaining.lastIndexOf(' ', MAX_POST_LENGTH);
        if (splitPoint === -1 || splitPoint < MAX_POST_LENGTH * 0.5) {
          // No good split point, force split
          splitPoint = MAX_POST_LENGTH;
        }

        posts.push(remaining.slice(0, splitPoint).trim());
        remaining = remaining.slice(splitPoint).trim();
      }
    }

    // Stop if we've hit the max
    if (posts.length >= MAX_THREAD_POSTS) {
      break;
    }
  }

  return posts.slice(0, MAX_THREAD_POSTS);
}

type ThreadComposerProps = {
  threadId: string;
  parentCast?: CastWithInteractions;
  onPublishSuccess?: () => void;
};

export default function ThreadComposer({ threadId, parentCast, onPublishSuccess }: ThreadComposerProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  const [publishingDrafts, setPublishingDrafts] = useState<DraftType[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [currentUploadDraftId, setCurrentUploadDraftId] = useState<string | null>(null);
  // Increment after reorder to force editor remount (TipTap breaks on DOM moves)
  const [reorderVersion, setReorderVersion] = useState(0);

  const {
    addPostToThread,
    removePostFromThread,
    reorderThreadPost,
    getThreadDrafts,
    publishThread,
    updateDraftById,
    addNewPostDraft,
  } = useDraftStore();

  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  const threadDrafts = getThreadDrafts(threadId);
  const canAddMore = threadDrafts.length < MAX_THREAD_POSTS;
  const isSingleCast = threadDrafts.length === 1;
  const showSchedule = isSingleCast;

  const { uploadImage, isUploading, error, image } = useCloudinaryUpload();

  // @dnd-kit sensors for mouse and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle upload completion - add embed to the draft that initiated the upload
  useEffect(() => {
    if (isUploading) {
      toast.loading('Uploading image...', {
        id: 'thread-image-upload',
      });
    } else if (image && currentUploadDraftId) {
      toast.success('Image uploaded', {
        id: 'thread-image-upload',
      });

      // Get current draft to check if embed already exists
      const draft = threadDrafts.find((d) => d.id === currentUploadDraftId);
      if (draft && !draft.embeds?.find((embed) => 'url' in embed && embed.url === image.link)) {
        updateDraftById(currentUploadDraftId, {
          embeds: [
            ...(draft.embeds || []),
            {
              status: 'loaded' as const,
              url: image.link,
              metadata: {
                image: {
                  url: image.link,
                  width: image.width,
                  height: image.height,
                },
              },
            },
          ],
        });
      }
      setCurrentUploadDraftId(null);
    } else if (error) {
      console.error('Failed uploading to cloudinary', error);
      toast.error(error, {
        id: 'thread-image-upload',
      });
      setCurrentUploadDraftId(null);
    }
  }, [isUploading, error, image, currentUploadDraftId, threadDrafts, updateDraftById]);

  // Prevent browser close during publishing
  useEffect(() => {
    if (!isPublishing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your thread is still publishing. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isPublishing]);

  const handleAddPost = useCallback(
    (afterIndex?: number) => {
      const newDraftId = addPostToThread(threadId, afterIndex);
      if (!newDraftId) {
        toast.error(`Maximum ${MAX_THREAD_POSTS} posts per thread`);
      }
    },
    [threadId, addPostToThread]
  );

  const handleRemovePost = useCallback(
    (draftId: string) => {
      if (threadDrafts.length <= 1) {
        toast.error('Thread must have at least one post');
        return;
      }
      removePostFromThread(threadId, draftId);
    },
    [threadId, threadDrafts.length, removePostFromThread]
  );

  // @dnd-kit drag end handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = threadDrafts.findIndex((d) => d.id === active.id);
        const newIndex = threadDrafts.findIndex((d) => d.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderThreadPost(threadId, oldIndex, newIndex);
          setReorderVersion((v) => v + 1);
        }
      }
    },
    [threadId, threadDrafts, reorderThreadPost]
  );

  const handleUploadMedia = useCallback(
    (draftId: string, file: File) => {
      setCurrentUploadDraftId(draftId);
      uploadImage(file);
    },
    [uploadImage]
  );

  const handleImportNotes = useCallback(() => {
    if (!importText.trim()) {
      toast.error('Please enter some text to import');
      return;
    }

    const posts = splitTextIntoPosts(importText);
    if (posts.length === 0) {
      toast.error('No content to import');
      return;
    }

    // Get current drafts
    const currentDrafts = getThreadDrafts(threadId);

    // Update first post with first chunk
    if (currentDrafts.length > 0 && posts.length > 0) {
      updateDraftById(currentDrafts[0].id, { text: posts[0] });
    }

    // Add remaining posts
    for (let i = 1; i < posts.length; i++) {
      const newDraftId = addPostToThread(threadId);
      if (newDraftId) {
        updateDraftById(newDraftId, { text: posts[i] });
      } else {
        toast.warning(`Could only import ${i} of ${posts.length} posts (max ${MAX_THREAD_POSTS})`);
        break;
      }
    }

    toast.success(`Imported ${Math.min(posts.length, MAX_THREAD_POSTS)} posts`);
    setImportText('');
    setIsImportDialogOpen(false);
  }, [importText, threadId, getThreadDrafts, updateDraftById, addPostToThread]);

  const handlePublishThread = useCallback(async () => {
    if (!selectedAccount) {
      toast.error('Please select an account first');
      return;
    }

    // Validate all posts have content
    const emptyPosts = threadDrafts.filter((d) => !d.text?.trim() && !d.embeds?.length);
    if (emptyPosts.length > 0) {
      toast.error('All posts must have content or embeds');
      return;
    }

    // Capture drafts at start so dialog doesn't change during publish
    setPublishingDrafts([...threadDrafts]);
    setIsPublishing(true);
    setPublishingIndex(0);

    try {
      const result = await publishThread(threadId, selectedAccount, (index) => {
        setPublishingIndex(index);
      });

      if (result.success) {
        toast.success(`Thread published! ${result.publishedPosts.length} posts`);
        onPublishSuccess?.();
      } else {
        toast.error(`Failed at post ${(result.failedAt ?? 0) + 1}: ${result.error || 'Unknown error'}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Thread publish error:', error);
      toast.error('Failed to publish thread');
    } finally {
      setIsPublishing(false);
      setPublishingIndex(null);
    }
  }, [threadId, selectedAccount, threadDrafts, publishThread, onPublishSuccess]);

  // Keyboard shortcut: Cmd+Shift+Enter to publish thread
  useAppHotkeys(
    'meta+shift+enter',
    handlePublishThread,
    {
      scopes: [HotkeyScopes.EDITOR],
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [handlePublishThread]
  );

  if (threadDrafts.length === 0) {
    return <div className="p-4 text-muted-foreground">No posts in thread</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addNewPostDraft({ force: true })} className="gap-1.5">
            <PlusIcon className="w-4 h-4" />
            New draft
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Import from notes">
                <DocumentTextIcon className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import from notes</DialogTitle>
                <DialogDescription>
                  Paste your long text and it will be automatically split into thread posts
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Paste your text here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-h-[200px]"
              />
              <span className="text-sm text-muted-foreground">
                Splits on paragraph breaks or at ~{MAX_POST_LENGTH} characters
              </span>
              <DialogFooter className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {importText.trim() ? `~${splitTextIntoPosts(importText).length} posts` : ''}
                </span>
                <Button onClick={handleImportNotes} disabled={!importText.trim()}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex-1" />
          <HotkeyTooltipWrapper hotkey="⌘ + ⇧ + Enter" side="bottom">
            <Button variant="outline" onClick={handlePublishThread} disabled={isPublishing || !selectedAccount}>
              {isPublishing
                ? `Publishing ${(publishingIndex ?? 0) + 1}/${threadDrafts.length}...`
                : isSingleCast
                  ? 'Post'
                  : 'Publish Thread'}
            </Button>
          </HotkeyTooltipWrapper>
        </div>
      </div>

      {/* Parent cast display when replying */}
      {parentCast && (
        <div className="px-4 pt-4 border-b pb-4">
          <CastRow cast={parentCast} isEmbed hideReactions />
        </div>
      )}

      {/* Scrollable post list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={threadDrafts.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col">
                {threadDrafts.map((draft, index) => (
                  <ThreadPostCard
                    key={`${draft.id}-${reorderVersion}`}
                    draft={draft}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === threadDrafts.length - 1}
                    canRemove={threadDrafts.length > 1}
                    canAddMore={canAddMore}
                    onRemove={() => handleRemovePost(draft.id)}
                    onAddPost={() => handleAddPost(index)}
                    onUploadMedia={(file) => handleUploadMedia(draft.id, file)}
                    isPublishing={isPublishing && publishingIndex !== null && index <= publishingIndex}
                    isCurrentlyPublishing={isPublishing && publishingIndex === index}
                    hideSchedule={!showSchedule || index > 0}
                    userPfpUrl={selectedAccount?.user?.pfp_url}
                    userName={selectedAccount?.user?.display_name || selectedAccount?.name}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Publishing overlay */}
      <Dialog open={isPublishing} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-[400px]"
          hideCloseButton
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing to Farcaster
            </DialogTitle>
            <DialogDescription>
              Please don&apos;t close this tab while your {publishingDrafts.length === 1 ? 'cast' : 'thread'} is being
              published.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {publishingDrafts.map((draft, index) => {
              const isComplete = publishingIndex !== null && index < publishingIndex;
              const isCurrent = publishingIndex === index;
              return (
                <div
                  key={draft.id}
                  className={`flex items-center gap-3 p-2 rounded-md transition-colors ${isCurrent ? 'bg-muted' : ''}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {isComplete ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={`text-sm truncate flex-1 ${isComplete ? 'text-muted-foreground' : ''}`}>
                    {draft.text?.slice(0, 50) || 'Empty post'}
                    {(draft.text?.length || 0) > 50 ? '...' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { ThreadComposer };
