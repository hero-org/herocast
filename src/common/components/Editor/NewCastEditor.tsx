import React, { RefObject, useEffect, useRef } from 'react';
import { useDraftStore } from '@/stores/useDraftStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useChannelLookup } from '@/common/hooks/useChannelLookup';
import { DraftStatus, DraftType } from '../../constants/farcaster';
import { toNeynarChannels } from '@/common/helpers/channels';
import { TOP_CHANNELS } from '@/common/constants/topChannels';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { EditorContent } from '@tiptap/react';
import { EmbedsEditor } from './EmbedsEditor';
import { useCastEditor } from '@/common/hooks/useCastEditor';
import type { FarcasterEmbed } from '@/common/types/embeds';

import { getFarcasterMentions } from '@mod-protocol/farcaster';
// import { createRenderMentionsSuggestionConfig } from '@mod-protocol/react-ui-shadcn/dist/lib/mentions';
import { createFixedMentionsSuggestionConfig as createRenderMentionsSuggestionConfig } from '@/lib/mentions/fixedMentions';
import { convertCastPlainTextToStructured } from '@/common/helpers/farcaster';
import { Button } from '@/components/ui/button';
import { take, debounce } from 'lodash';
import type { DebouncedFunc } from 'lodash';
import { useMemo, useCallback } from 'react';
import { ChannelPicker } from '../ChannelPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDaysIcon, PhotoIcon, LinkIcon } from '@heroicons/react/20/solid';
import { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { ChannelList } from '../ChannelList';
import isEmpty from 'lodash.isempty';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { usePostHog } from 'posthog-js/react';
import { useTextLength } from '../../helpers/editor';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { isPaidUser } from '@/stores/useUserStore';
import { MentionList } from '../MentionsList';
import { useCloudinaryUpload } from '@/common/hooks/useCloudinaryUpload';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import { format, startOfToday } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!;
const getMentions = getFarcasterMentions(API_URL);

// fetchUrlMetadata - simplified version (we don't use this for now, images go direct to cloudinary)
const fetchUrlMetadata = async (url: string): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(`/api/embeds/metadata?url=${encodeURIComponent(url)}`);
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
};

const getChannels = async (query: string): Promise<Channel[]> => {
  if (query.length < 2) return [];
  try {
    const response = await fetch(`/api/channels/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return take(data?.channels ?? [], 10);
  } catch (e) {
    console.error(`Error searching channels: ${e}`);
    return [];
  }
};

const getDefaultScheduleTime = (): Date => {
  // Returns date 1 hour from now, rounded to nearest 5 minutes
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 5) * 5;
  const date = new Date(now);
  date.setMinutes(roundedMinutes);
  date.setSeconds(0);
  date.setMilliseconds(0);
  date.setHours(date.getHours() + 1);
  return date;
};

const onError = (err) => {
  console.error('Editor error:', err);
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'development') {
    window.alert(err.message);
  }
  // Ensure errors are properly logged in production
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(err);
  }
};

type NewPostEntryProps = {
  draft: DraftType;
  onPost?: () => void;
  onRemove?: () => void;
  hideChannel?: boolean;
  hideSchedule?: boolean;
  disableAutofocus?: boolean;
};

export default function NewPostEntry({ draft, onPost, onRemove, hideChannel, hideSchedule }: NewPostEntryProps) {
  const posthog = usePostHog();
  const { updateDraftById, publishDraftById, scheduleDraftById } = useDraftStore();
  const [scheduleDateTime, setScheduleDateTime] = React.useState<Date>();
  const [schedulePopoverOpen, setSchedulePopoverOpen] = React.useState(false);
  const [replyToUrl, setReplyToUrl] = React.useState<string>('');
  const [replyToUrlPopoverOpen, setReplyToUrlPopoverOpen] = React.useState(false);
  const [editorKey, setEditorKey] = React.useState(0);

  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleActiveAccounts =
    useAccountStore(
      (state) =>
        state.accounts.filter((account) => {
          return account.status === 'active';
        }).length
    ) > 1;
  const { isHydrated, accounts, selectedAccountIdx } = useAccountStore();

  // Debounced sync function ref for reliable auto-save with flush capability
  const debouncedSyncRef = useRef<DebouncedFunc<(id: string, updates: any) => void> | null>(null);

  // Use on-demand channel lookup for draft's parent URL
  const { channel: draftChannel } = useChannelLookup(draft.parentUrl);

  // Use pinned channels instead of all channels for better performance
  const userChannels = accounts[selectedAccountIdx]?.channels || [];
  const isReply = draft.parentCastId !== undefined;

  // Initialize debounce function (stable across renders)
  useEffect(() => {
    debouncedSyncRef.current = debounce(
      (id: string, updates: any) => {
        updateDraftById(id, updates);
      },
      300,
      { leading: false, trailing: true }
    );

    return () => {
      // FLUSH on unmount to preserve user's pending work
      debouncedSyncRef.current?.flush();
    };
  }, [updateDraftById]);

  const validateScheduledDateTime = (date: Date) => {
    if (!scheduleDateTime) return true;

    if (date < new Date()) {
      toast.info('Select a schedule time in the future');
      return false;
    }
    return true;
  };

  const onSubmitPost = async (): Promise<boolean> => {
    try {
      if (!isHydrated) return false;

      // Validate using EDITOR content (store may be stale before flush)
      const currentText = getText();
      if (!currentText && !embeds.length) return false;

      if (scheduleDateTime && !validateScheduledDateTime(scheduleDateTime)) {
        return false;
      }

      // CRITICAL: Flush FIRST - guarantees store has latest content
      debouncedSyncRef.current?.flush();

      // Close modal immediately for better UX flow (optimistic close)
      onPost?.();

      if (scheduleDateTime) {
        posthog.capture('user_schedule_cast');
        await updateDraftById(draft.id, {
          status: DraftStatus.publishing,
        });
        await scheduleDraftById(draft.id, scheduleDateTime, () => {
          console.log('onSuccess after scheduleDraftById');
          setScheduleDateTime(undefined);
        });
      } else {
        posthog.capture('user_post_cast');
        // Don't pass onPost - we already called it above (optimistic close)
        publishDraftById(draft.id, account);
      }
      return true;
    } catch (error) {
      console.error('Error submitting post:', error);
      toast.error('Failed to submit post. Please try again.');
      return false;
    }
  };

  const ref = useAppHotkeys(
    'meta+enter',
    onSubmitPost,
    {
      scopes: [HotkeyScopes.EDITOR],
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true, // Prevent TipTap's HardBreak from inserting newline
    },
    [onSubmitPost, draft, account, isHydrated]
  );

  const { uploadImage, isUploading, error, image } = useCloudinaryUpload();

  useEffect(() => {
    if (isUploading) {
      toast.loading('Uploading image...', {
        id: 'image-upload',
      });
    } else if (image) {
      toast.success('Image uploaded', {
        id: 'image-upload',
      });

      if (!embeds.find((embed) => 'url' in embed && embed.url === image.link)) {
        setEmbeds([
          ...embeds,
          {
            status: 'loaded',
            url: image.link,
            metadata: {
              image: {
                url: image.link,
                width: image.width,
                height: image.height,
              },
            },
          },
        ]);
      }
    } else if (error) {
      console.error('failed uploading to cloudinary', error);
      toast.error(error, {
        id: 'image-upload',
      });
    }
  }, [isUploading, error, image]);

  const isPublishing = draft.status === DraftStatus.publishing;

  // Track mentions captured from dropdown selections
  const [capturedMentions, setCapturedMentions] = React.useState<{ [key: string]: string }>({});

  // Create enhanced mention configuration that captures FIDs
  const mentionConfig = useMemo(() => {
    return createRenderMentionsSuggestionConfig({
      getResults: async (query: string) => {
        try {
          const results = await getMentions(query);
          // When results come back, check if any have FIDs and capture them
          // Use setTimeout to avoid state updates during render
          if (results && Array.isArray(results)) {
            setTimeout(() => {
              const newMentions = {};
              results.forEach((mention) => {
                if (mention && mention.username && mention.fid) {
                  newMentions[mention.username] = mention.fid.toString();
                }
              });
              if (Object.keys(newMentions).length > 0) {
                setCapturedMentions((prev) => ({
                  ...prev,
                  ...newMentions,
                }));
              }
            }, 0);
          }
          return results;
        } catch (error) {
          console.error('Error fetching mentions:', error);
          return [];
        }
      },
      RenderList: MentionList,
    });
  }, []);

  const {
    editor,
    getText,
    setText,
    embeds,
    getEmbeds,
    setEmbeds,
    addEmbed,
    removeEmbed,
    channel,
    getChannel,
    setChannel,
    handleSubmit,
  } = useCastEditor({
    onError,
    onSubmit: onSubmitPost,
    linkClassName: 'text-blue-500',
    renderChannelsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: getChannels,
      RenderList: ChannelList,
    }),
    renderMentionsSuggestionConfig: mentionConfig,
    editorOptions: {
      editorProps: {
        handlePaste: (view, event) => {
          const { state } = view;
          const isFullSelection = state.selection.from === 0 && state.selection.to === state.doc.content.size;

          // Fix for TipTap bug: select-all + paste throws position error
          if (isFullSelection && event.clipboardData?.getData('text/plain') && editor) {
            editor.commands.setContent(event.clipboardData.getData('text/plain'));
            return true;
          }

          // Handle image uploads
          const handled = extractImageAndUpload({
            data: event.clipboardData,
            uploadImage,
          });

          return handled;
        },
        handleDrop: (view, event) => {
          const handled = extractImageAndUpload({
            data: event.dataTransfer,
            uploadImage,
          });

          return handled;
        },
      },
    },
  });

  // Track the draft.id to detect when switching between drafts
  const lastDraftIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!editor) return;

    // Detect draft switch - reset embeds when draft.id changes
    if (draft.id !== lastDraftIdRef.current) {
      lastDraftIdRef.current = draft.id;

      // Set text content from draft
      if (draft.text) {
        try {
          editor.commands.setContent(`<p>${draft.text.replace(/\n/g, '<br>')}</p>`, {
            emitUpdate: true,
            parseOptions: { preserveWhitespace: 'full' },
          });
        } catch (error) {
          console.error('Error setting initial editor content:', error);
        }
      }

      // Set embeds from draft - single source of truth, no merge
      if (draft.embeds && draft.embeds.length > 0) {
        setEmbeds(draft.embeds);
      } else {
        setEmbeds([]);
      }
    }
  }, [editor, draft.id, draft.text, draft.embeds, setEmbeds]);

  const text = getText();

  const {
    label: textLengthWarning,
    isValid: textLengthIsValid,
    tailwindColor: textLengthTailwind,
  } = useTextLength({ text, isPro: account?.user?.pro?.status === 'subscribed' });

  // Memoized mention extraction - only runs when text changes and contains @
  const extractMentionsFromText = useMemo(() => {
    if (!text || !text.includes('@')) return {};

    const structuredUnits = convertCastPlainTextToStructured({ text });
    const mentionUnits = structuredUnits.filter((unit) => unit.type === 'mention');

    return mentionUnits.reduce(
      (acc, unit) => {
        const username = unit.serializedContent.replace('@', '');
        // Only include mentions with valid FIDs - prioritize captured mentions, then existing mappings
        const fid = capturedMentions[username] || draft.mentionsToFids?.[username];
        if (fid && fid !== '') {
          acc[username] = fid;
        }
        return acc;
      },
      {} as { [key: string]: string }
    );
  }, [text, capturedMentions, draft.mentionsToFids]);

  useEffect(() => {
    if (!editor) return;
    if (isPublishing) return;

    // Call debounced sync - NO cleanup (let debounce batch changes)
    // Priority: replyToUrl takes precedence over channel.parent_url (mutual exclusivity)
    const effectiveParentUrl = replyToUrl || channel?.parent_url || undefined;
    debouncedSyncRef.current?.(draft.id, {
      text,
      embeds,
      parentUrl: effectiveParentUrl,
      mentionsToFids: extractMentionsFromText,
    });
  }, [text, embeds, channel, replyToUrl, isPublishing, editor, extractMentionsFromText, draft.id]);

  // Track whether initial channel has been set to prevent overwriting user selections
  const hasSetInitialChannel = useRef(false);

  useEffect(() => {
    if (hasSetInitialChannel.current) return;
    if (!draft || !draft.parentUrl) return;

    // First try user's pinned channels for performance
    const pinnedChannel = userChannels.find((c) => c.url === draft.parentUrl);
    if (pinnedChannel) {
      setChannel({
        id: pinnedChannel.name,
        url: pinnedChannel.url,
        name: pinnedChannel.name,
        object: 'channel',
        image_url: pinnedChannel.icon_url,
        parent_url: pinnedChannel.url,
        description: '',
        created_at: 0,
        lead: {},
      });
      hasSetInitialChannel.current = true;
    } else if (draftChannel) {
      // Use the on-demand loaded channel
      setChannel({
        id: draftChannel.name,
        url: draftChannel.url,
        name: draftChannel.name,
        object: 'channel',
        image_url: draftChannel.icon_url,
        parent_url: draftChannel.url,
        description: '',
        created_at: 0,
        lead: {},
      });
      hasSetInitialChannel.current = true;
    }
  }, [draft.parentUrl, userChannels, draftChannel]);

  const getButtonText = () => {
    if (isPublishing) return scheduleDateTime ? 'Scheduling...' : 'Publishing...';

    return `${scheduleDateTime ? 'Schedule' : 'Cast'}${account && hasMultipleActiveAccounts ? ` as ${account.name}` : ''}`;
  };

  const scheduledCastCount =
    useDraftStore((state) => state.drafts.filter((draft) => draft.status === DraftStatus.scheduled))?.length || 0;
  const openSourcePlanLimits = getPlanLimitsForPlan('openSource');
  const hasReachedFreePlanLimit = !isPaidUser() && scheduledCastCount >= openSourcePlanLimits.maxScheduledCasts;
  const isButtonDisabled = isPublishing || !textLengthIsValid || (scheduleDateTime && hasReachedFreePlanLimit);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        editor.destroy();
      }
    };
  }, [editor]);

  return (
    <div
      className="flex flex-col items-start min-w-full w-full h-full"
      ref={ref as RefObject<HTMLDivElement>}
      tabIndex={-1}
      key={`${draft.id}-${editorKey}`}
    >
      <div className="flex flex-col rounded-lg w-full p-4 pb-4 gap-y-2 border">
        {!editor ? (
          <div className="px-2 py-1 w-full h-full min-h-[150px] text-foreground/80">
            <Skeleton className="px-2 py-1 w-full h-full min-h-[150px] text-foreground/80">{draft.text}</Skeleton>
          </div>
        ) : (
          <div className="p-2 border-slate-200 rounded-lg border">
            <EditorContent editor={editor} autoFocus className="w-full h-full min-h-[150px] text-foreground/80" />
          </div>
        )}

        <div className="flex flex-row py-2 gap-1 overflow-x-auto no-scrollbar">
          {!isReply && !hideChannel && (
            <>
              <ChannelPicker
                value={channel ? (channel as unknown as Channel) : undefined}
                onSelect={(ch) => {
                  // Clear reply URL when channel is selected (mutual exclusivity)
                  setReplyToUrl('');
                  if (ch) {
                    // Convert Neynar Channel to our channel format
                    setChannel({
                      id: ch.id,
                      url: ch.parent_url ?? '',
                      name: ch.name ?? ch.id,
                      object: 'channel',
                      image_url: ch.image_url ?? '',
                      parent_url: ch.parent_url ?? '',
                      description: '',
                      created_at: 0,
                      lead: {},
                    });
                  } else {
                    setChannel(null);
                  }
                  // Return focus to editor after channel selection
                  setTimeout(() => editor?.commands.focus(), 0);
                }}
                initialChannels={[...toNeynarChannels(userChannels), ...(TOP_CHANNELS as Channel[])]}
                getChannels={getChannels}
                disabled={isPublishing}
              />
              <Popover open={replyToUrlPopoverOpen} onOpenChange={setReplyToUrlPopoverOpen} modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPublishing}
                    className={cn(replyToUrl && 'border-primary bg-primary/10')}
                    title={replyToUrl ? `Reply to: ${replyToUrl}` : 'Reply to URL'}
                  >
                    <LinkIcon className={cn('h-4 w-4', replyToUrl && 'text-primary')} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3 z-[100]" align="start">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Reply to URL</Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={replyToUrl}
                      onChange={(e) => {
                        setReplyToUrl(e.target.value);
                        // Clear channel when URL is set (mutual exclusivity)
                        if (e.target.value) {
                          setChannel(null);
                        }
                      }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setReplyToUrlPopoverOpen(false);
                          editor?.commands.focus();
                        }
                      }}
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setReplyToUrl('');
                          setReplyToUrlPopoverOpen(false);
                          editor?.commands.focus();
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setReplyToUrlPopoverOpen(false);
                          editor?.commands.focus();
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*,video/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) uploadImage(file);
              };
              input.click();
            }}
            variant="outline"
            disabled={isPublishing}
          >
            <PhotoIcon className="mr-1 h-4 w-4" />
            Media
          </Button>
          {!hideSchedule && (
            <Popover open={schedulePopoverOpen} onOpenChange={setSchedulePopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPublishing}
                  onClick={() => {
                    if (!scheduleDateTime) {
                      setScheduleDateTime(getDefaultScheduleTime());
                    }
                    setSchedulePopoverOpen(true);
                  }}
                >
                  <CalendarDaysIcon className="mr-1 h-4 w-4" />
                  {scheduleDateTime ? (
                    <span className="font-mono">{format(scheduleDateTime, 'MM/dd/yyyy hh:mm a')}</span>
                  ) : (
                    'Schedule'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[520px] p-0 z-[100]" align="center">
                <div className="flex">
                  {/* Calendar Section */}
                  <div className="p-3 border-r">
                    <Calendar
                      mode="single"
                      selected={scheduleDateTime}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          const newDate = new Date(date);
                          if (scheduleDateTime) {
                            newDate.setHours(scheduleDateTime.getHours(), scheduleDateTime.getMinutes(), 0, 0);
                          } else {
                            newDate.setHours(14, 0, 0, 0); // Default 14:00 UTC
                          }
                          setScheduleDateTime(newDate);
                        }
                      }}
                      disabled={{ before: startOfToday() }}
                    />
                  </div>

                  {/* Time + Presets Section */}
                  <div className="p-3 w-[240px] space-y-3">
                    {/* Time Input */}
                    {scheduleDateTime && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Time (24h)</Label>
                        <Input
                          type="time"
                          value={format(scheduleDateTime, 'HH:mm')}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':').map(Number);
                            const newDate = new Date(scheduleDateTime);
                            newDate.setHours(hours, minutes, 0, 0);
                            setScheduleDateTime(newDate);
                          }}
                          step="300"
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(scheduleDateTime, "MMM d, yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    )}

                    {/* Quick Presets */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Quick presets</Label>
                      <div className="space-y-1">
                        {[
                          { label: 'US Morning', hour: 14, desc: '9 AM ET' },
                          { label: 'US Afternoon', hour: 18, desc: '1 PM ET' },
                          { label: 'US Evening', hour: 23, desc: '6 PM ET' },
                          { label: 'EU Morning', hour: 8, desc: '9 AM CET' },
                          { label: 'Asia Evening', hour: 9, desc: '6 PM JST' },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-xs"
                            onClick={() => {
                              const newDate = scheduleDateTime ? new Date(scheduleDateTime) : getDefaultScheduleTime();
                              newDate.setHours(preset.hour, 0, 0, 0);
                              if (newDate < new Date()) {
                                newDate.setDate(newDate.getDate() + 1);
                              }
                              setScheduleDateTime(newDate);
                            }}
                          >
                            <span>{preset.label}</span>
                            <span className="text-muted-foreground">{preset.desc}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-2 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setScheduleDateTime(undefined);
                          setSchedulePopoverOpen(false);
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setSchedulePopoverOpen(false)}
                        disabled={!scheduleDateTime || scheduleDateTime < new Date()}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <div className="flex-grow"></div>
          <label className={cn('flex items-center text-xs', `text-${textLengthTailwind}`)}>{textLengthWarning}</label>
          {hasReachedFreePlanLimit && (
            <p className="text-xs text-yellow-600 flex items-center">
              Free accounts are limited to {openSourcePlanLimits.maxScheduledCasts} scheduled casts.{' '}
              <Link href="/upgrade" className="underline">
                Upgrade to schedule more
              </Link>
              .
            </p>
          )}
        </div>

        <div className="flex flex-row">
          {onRemove && (
            <div
              onClick={() => {
                onRemove && onRemove();
              }}
              className="flex items-center cursor-pointer"
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onRemove && onRemove();
                }}
                disabled={isPublishing}
              >
                Remove
              </Button>
            </div>
          )}
          <div className="grow"></div>
          <Button
            size="sm"
            disabled={isButtonDisabled}
            className="float-right"
            onClick={() => {
              onSubmitPost();
            }}
          >
            {getButtonText()}
          </Button>
        </div>
        {embeds.length > 0 && (
          <div className="w-full overflow-hidden pt-3 mt-1 border-t border-muted">
            <EmbedsEditor embeds={[...embeds]} setEmbeds={setEmbeds} removeEmbed={removeEmbed} />
          </div>
        )}
      </div>
    </div>
  );
}

function extractImageAndUpload(args: { data: DataTransfer | null; uploadImage: (file: File) => void }): boolean {
  const { data, uploadImage } = args;

  if (!data) {
    return false;
  }

  const items = Array.from(data.items);
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const file = item.getAsFile();
      if (file != null) {
        uploadImage(file);
        return true;
      }
    }
  }

  const files = Array.from(data.files);
  for (const file of files) {
    if (file.type.indexOf('image') === 0) {
      uploadImage(file);
      return true;
    }
  }

  return false;
}
