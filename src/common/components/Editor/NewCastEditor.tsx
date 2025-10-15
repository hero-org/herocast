import React, { RefObject, useEffect } from 'react';
import { useDraftStore } from '@/stores/useDraftStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useChannelLookup } from '@/common/hooks/useChannelLookup';
import { DraftStatus, DraftType } from '../../constants/farcaster';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { useEditor, EditorContent } from '@mod-protocol/react-editor';
import { EmbedsEditor } from '@mod-protocol/react-ui-shadcn/dist/lib/embeds';

import { fetchUrlMetadata, handleAddEmbed, handleOpenFile, handleSetInput } from '@mod-protocol/core';
import { getFarcasterMentions } from '@mod-protocol/farcaster';
// import { createRenderMentionsSuggestionConfig } from '@mod-protocol/react-ui-shadcn/dist/lib/mentions';
import { createFixedMentionsSuggestionConfig as createRenderMentionsSuggestionConfig } from '@/lib/mentions/fixedMentions';
import { convertCastPlainTextToStructured } from '@/common/helpers/farcaster';
import { Button } from '@/components/ui/button';
import { take } from 'lodash';
import { useMemo, useCallback } from 'react';
import { ChannelPicker } from '../ChannelPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import map from 'lodash.map';
import { renderEmbedForUrl } from '../Embeds';
import { CalendarDaysIcon, PhotoIcon } from '@heroicons/react/20/solid';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { ChannelList } from '../ChannelList';
import isEmpty from 'lodash.isempty';
import { Skeleton } from '@/components/ui/skeleton';
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
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
import { useImgurUpload } from '@/common/hooks/useImgurUpload';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import { format, startOfToday } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!;
const getMentions = getFarcasterMentions(API_URL);
const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

const getChannels = async (query: string): Promise<Channel[]> => {
  let channels: Channel[] = [];
  if (query.length < 2) return [];
  channels = (await neynarClient.searchChannels(query))?.channels ?? [];
  return take(channels, 10);
};

const getAllChannels = async (): Promise<Channel[]> => {
  try {
    return (await neynarClient.fetchAllChannels())?.channels ?? [];
  } catch (e) {
    console.error(`Error fetching all channels: ${e}`);
    return [];
  }
};

const getUrlMetadata = fetchUrlMetadata(API_URL);

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
  draftIdx: number;
  onPost?: () => void;
  onRemove?: () => void;
  hideChannel?: boolean;
  hideSchedule?: boolean;
  disableAutofocus?: boolean;
};

export default function NewPostEntry({
  draft,
  draftIdx,
  onPost,
  onRemove,
  hideChannel,
  hideSchedule,
}: NewPostEntryProps) {
  const posthog = usePostHog();
  const { addScheduledDraft, updatePostDraft, publishPostDraft } = useDraftStore();
  const [initialEmbeds, setInitialEmbeds] = React.useState<FarcasterEmbed[]>();
  const [scheduleDateTime, setScheduleDateTime] = React.useState<Date>();
  const [schedulePopoverOpen, setSchedulePopoverOpen] = React.useState(false);
  const [editorKey, setEditorKey] = React.useState(0);

  const hasEmbeds = draft.embeds && !!draft.embeds.length;
  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleActiveAccounts =
    useAccountStore(
      (state) =>
        state.accounts.filter((account) => {
          return account.status === 'active';
        }).length
    ) > 1;
  const { isHydrated, accounts, selectedAccountIdx } = useAccountStore();

  // Use on-demand channel lookup for draft's parent URL
  const { channel: draftChannel } = useChannelLookup(draft.parentUrl);

  // Use pinned channels instead of all channels for better performance
  const userChannels = accounts[selectedAccountIdx]?.channels || [];
  const isReply = draft.parentCastId !== undefined;

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

      if (!draft.text && !draft.embeds?.length) return false;

      if (scheduleDateTime && !validateScheduledDateTime(scheduleDateTime)) {
        return false;
      }

      // Close the modal immediately by calling onPost
      onPost?.();

      if (scheduleDateTime) {
        posthog.capture('user_schedule_cast');
        await updatePostDraft(draftIdx, {
          ...draft,
          status: DraftStatus.publishing,
        });
        await addScheduledDraft({
          draftIdx,
          scheduledFor: scheduleDateTime,
          onSuccess: () => {
            console.log('onSuccess after addScheduledDraft');
            setScheduleDateTime(undefined);
          },
        });
      } else {
        posthog.capture('user_post_cast');
        await publishPostDraft(draftIdx, account);
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
    },
    [onSubmitPost, draft, account, isHydrated]
  );

  const { uploadImage, isUploading, error, image } = useImgurUpload();

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
      console.error('failed uploading to imgur', error);
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

  const { editor, getText, addEmbed, getEmbeds, setEmbeds, setChannel, getChannel, handleSubmit, setText } = useEditor({
    fetchUrlMetadata: getUrlMetadata,
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

      parseOptions: {
        preserveWhitespace: 'full',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    // Only set initial content once when editor is ready
    if (!text && draft.text && isEmpty(draft.mentionsToFids)) {
      try {
        editor.commands.setContent(`<p>${draft.text.replace(/\n/g, '<br>')}</p>`, true, {
          preserveWhitespace: 'full',
        });
      } catch (error) {
        console.error('Error setting initial editor content:', error);
      }
    }

    if (draft.embeds && !initialEmbeds) {
      setInitialEmbeds(draft.embeds);
    }
  }, [editor, draft.text, draft.embeds, initialEmbeds]);

  const text = getText();
  const embeds = getEmbeds();
  const channel = getChannel();

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
    if (!editor) return; // no updates before editor is initialized
    if (isPublishing) return;

    // Debounce draft updates to avoid rapid state changes
    const timeoutId = setTimeout(() => {
      const newEmbeds = initialEmbeds ? [...embeds, ...initialEmbeds] : embeds;

      // Use the original draft data with only the changed fields
      updatePostDraft(draftIdx, {
        ...draft,
        text,
        embeds: newEmbeds,
        parentUrl: channel?.parent_url || undefined,
        mentionsToFids: extractMentionsFromText,
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    text,
    embeds,
    initialEmbeds,
    channel,
    isPublishing,
    editor,
    extractMentionsFromText,
    draftIdx,
    draft,
    updatePostDraft,
  ]);

  useEffect(() => {
    if (!draft || !draft.parentUrl) return;

    // First try user's pinned channels for performance
    const pinnedChannel = userChannels.find((c) => c.url === draft.parentUrl);
    if (pinnedChannel) {
      setChannel({
        id: pinnedChannel.name,
        url: pinnedChannel.url,
        name: pinnedChannel.name,
        object: 'channel',
        // @ts-expect-error - mod protocol channel type mismatch
        image_url: pinnedChannel.icon_url,
        parent_url: pinnedChannel.url,
        description: '',
        created_at: 0,
        // @ts-expect-error - mod protocol channel type mismatch
        lead: {},
      });
    } else if (draftChannel) {
      // Use the on-demand loaded channel
      setChannel({
        id: draftChannel.name,
        url: draftChannel.url,
        name: draftChannel.name,
        object: 'channel',
        // @ts-expect-error - mod protocol channel type mismatch
        image_url: draftChannel.icon_url,
        parent_url: draftChannel.url,
        description: '',
        created_at: 0,
        // @ts-expect-error - mod protocol channel type mismatch
        lead: {},
      });
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
            <EmbedsEditor embeds={[...embeds]} setEmbeds={setEmbeds} RichEmbed={() => <div />} />
          </div>
        )}

        <div className="flex flex-row py-2 gap-1 overflow-x-auto no-scrollbar">
          {!isReply && !hideChannel && (
            <>
              <ChannelPicker
                value={channel || undefined}
                onSelect={setChannel}
                channels={userChannels}
                // @ts-expect-error - channel type from mod protocol has different shape
                getAllChannels={getAllChannels}
                disabled={isPublishing}
              />
            </>
          )}
          <Button
            size="sm"
            onClick={() => handleOpenFile({ addEmbed: (e) => addEmbed(e.url) })}
            variant="outline"
            disabled={isPublishing}
          >
            <PhotoIcon className="mr-1 h-4 w-4" />
            Media
          </Button>
          {!hideSchedule && (
            <Popover open={schedulePopoverOpen} onOpenChange={setSchedulePopoverOpen}>
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
                    <span className="font-mono">
                      {format(scheduleDateTime, 'MM/dd/yyyy hh:mm a')}
                    </span>
                  ) : (
                    'Schedule'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[520px] p-0" align="center">
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
      </div>
      {hasEmbeds && (
        <div className="flex flex-col md:flex-row items-center my-4 w-full gap-2 flex-wrap">
          {map(draft.embeds, (embed, idx) => (
            <div className="max-w-xl rounded-md border border-gray-200" key={`embed-preview-${idx}`}>
              {renderEmbedForUrl({
                url: embed.url,
                castEmbedData: {
                  cast_id: embed.cast_id ?? undefined,
                },
              })}
            </div>
          ))}
        </div>
      )}
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
