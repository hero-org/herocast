import React, { RefObject, useEffect } from 'react';
import { useDraftStore } from '@/stores/useDraftStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { DraftStatus, DraftType } from '../../constants/farcaster';
import { useHotkeys } from 'react-hotkeys-hook';
import { useEditor, EditorContent } from '@mod-protocol/react-editor';
import { EmbedsEditor } from '@mod-protocol/react-ui-shadcn/dist/lib/embeds';

import { ModManifest, fetchUrlMetadata, handleAddEmbed, handleOpenFile, handleSetInput } from '@mod-protocol/core';
import { getFarcasterMentions } from '@mod-protocol/farcaster';
import { createRenderMentionsSuggestionConfig } from '@mod-protocol/react-ui-shadcn/dist/lib/mentions';
import { Button } from '@/components/ui/button';
import { take } from 'lodash';
import { ChannelPicker } from '../ChannelPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreationMod } from '@mod-protocol/react';
import { creationMods } from '@mod-protocol/mod-registry';
import { renderers } from '@mod-protocol/react-ui-shadcn/dist/renderers';
import map from 'lodash.map';
import { renderEmbedForUrl } from '../Embeds';
import { CalendarDaysIcon, PhotoIcon } from '@heroicons/react/20/solid';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { ChannelList } from '../ChannelList';
import isEmpty from 'lodash.isempty';
import { Skeleton } from '@/components/ui/skeleton';
import type { FarcasterEmbed } from '@mod-protocol/farcaster';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { toast } from 'sonner';
import { usePostHog } from 'posthog-js/react';
import { useTextLength } from '../../helpers/editor';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { isPaidUser } from '@/stores/useUserStore';
import { MentionList } from '../MentionsList';
import { useImgurUpload } from '@/common/hooks/useImgurUpload';
import { getPlanLimitsForPlan } from '@/config/planLimits';

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

const onError = (err) => {
  console.error(err);
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'development') {
    window.alert(err.message);
  }
};

type NewPostEntryProps = {
  draft?: DraftType;
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
  const [currentMod, setCurrentMod] = React.useState<ModManifest | null>(null);
  const [initialEmbeds, setInitialEmbeds] = React.useState<FarcasterEmbed[]>();
  const [scheduleDateTime, setScheduleDateTime] = React.useState<Date>();

  const hasEmbeds = draft?.embeds && !!draft.embeds.length;
  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleActiveAccounts =
    useAccountStore(
      (state) =>
        state.accounts.filter((account) => {
          return account.status === 'active';
        }).length
    ) > 1;
  const { allChannels } = useAccountStore();
  const isReply = draft?.parentCastId !== undefined;

  useEffect(() => {
    if (scheduleDateTime) {
      const minutes = scheduleDateTime.getMinutes();
      const remainder = minutes % 5;
      // server only supports scheduling in 5 minute increments
      if (remainder !== 0) {
        const newMinutes = Math.round(minutes / 5) * 5;
        const newDate = new Date(scheduleDateTime);
        newDate.setMinutes(newMinutes);
        setScheduleDateTime(newDate);
      }
    }
  }, [scheduleDateTime]);

  const validateScheduledDateTime = (date: Date) => {
    if (!scheduleDateTime) return true;

    if (date < new Date()) {
      toast.info('Select a schedule time in the future');
      return false;
    }
    return true;
  };

  const onSubmitPost = async (): Promise<boolean> => {
    if (!draft?.text && !draft?.embeds?.length) return false;

    if (!validateScheduledDateTime(scheduleDateTime)) {
      return false;
    }

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
          onPost?.();
        },
      });
    } else {
      posthog.capture('user_post_cast');
      await publishPostDraft(draftIdx, account, onPost);
    }
    return true;
  };

  const ref = useHotkeys('meta+enter', onSubmitPost, [onSubmitPost, draft, account], {
    enableOnFormTags: true,
  });

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

  const isPublishing = draft?.status === DraftStatus.publishing;
  const { editor, getText, addEmbed, getEmbeds, setEmbeds, setChannel, getChannel, handleSubmit, setText } = useEditor({
    fetchUrlMetadata: getUrlMetadata,
    onError,
    onSubmit: onSubmitPost,
    linkClassName: 'text-blue-500',
    renderChannelsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: getChannels,
      RenderList: ChannelList,
    }),
    renderMentionsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: getMentions,
      RenderList: MentionList,
    }),
    editorOptions: {
      editorProps: {
        handlePaste: (view, event) =>
          extractImageAndUpload({
            data: event.clipboardData,
            uploadImage,
          }),
        handleDrop: (view, event) =>
          extractImageAndUpload({
            data: event.dataTransfer,
            uploadImage,
          }),
      },

      parseOptions: {
        preserveWhitespace: 'full',
      },
    },
  });

  useEffect(() => {
    if (!text && draft?.text && isEmpty(draft.mentionsToFids)) {
      editor?.commands.setContent(`<p>${draft.text.replace(/\n/g, '<br>')}</p>`, true, {
        preserveWhitespace: 'full',
      });
    }

    if (draft?.embeds) {
      setInitialEmbeds(draft.embeds);
    }
  }, [editor]);

  const text = getText();
  const embeds = getEmbeds();
  const channel = getChannel();

  const {
    label: textLengthWarning,
    isValid: textLengthIsValid,
    tailwindColor: textLengthTailwind,
  } = useTextLength({ text });

  useEffect(() => {
    if (!editor) return; // no updates before editor is initialized
    if (isPublishing) return;

    const newEmbeds = initialEmbeds ? [...embeds, ...initialEmbeds] : embeds;
    updatePostDraft(draftIdx, {
      ...draft,
      text,
      embeds: newEmbeds,
      parentUrl: channel?.parent_url || undefined,
    });
  }, [text, embeds, initialEmbeds, channel, isPublishing, editor]);

  useEffect(() => {
    if (!draft) return;
    if (draft?.parentUrl) {
      const rawChannel = allChannels.find((c) => c.url === draft.parentUrl);
      if (rawChannel) {
        setChannel({
          id: rawChannel.name,
          url: rawChannel.url,
          name: rawChannel.name,
          object: 'channel',
          // @ts-expect-error - mod protocol channel type mismatch
          image_url: rawChannel.icon_url,
          parent_url: rawChannel.url,
          description: '',
          created_at: 0,
          // @ts-expect-error - mod protocol channel type mismatch
          lead: {},
        });
      }
    }
  }, [draft?.parentUrl]);

  const getButtonText = () => {
    if (isPublishing) return scheduleDateTime ? 'Scheduling...' : 'Publishing...';

    return `${scheduleDateTime ? 'Schedule' : 'Cast'}${account && hasMultipleActiveAccounts ? ` as ${account.name}` : ''}`;
  };

  const scheduledCastCount =
    useDraftStore((state) => state.drafts.filter((draft) => draft.status === DraftStatus.scheduled))?.length || 0;
  const openSourcePlanLimits = getPlanLimitsForPlan('openSource');
  const hasReachedFreePlanLimit = !isPaidUser() && scheduledCastCount >= openSourcePlanLimits.maxScheduledCasts;
  const isButtonDisabled = isPublishing || !textLengthIsValid || (scheduleDateTime && hasReachedFreePlanLimit);

  if (!draft) return null;

  return (
    <div
      className="flex flex-col items-start min-w-full w-full h-full"
      ref={ref as RefObject<HTMLDivElement>}
      tabIndex={-1}
      key={draft.id}
    >
      <form onSubmit={handleSubmit} className="w-full">
        {isPublishing ? (
          <div className="w-full h-full min-h-[150px]">
            <Skeleton className="px-2 py-1 w-full h-full min-h-[150px] text-foreground/80">{draft.text}</Skeleton>
          </div>
        ) : (
          <div className="p-2 border-slate-200 rounded-lg border">
            <EditorContent editor={editor} autoFocus className="w-full h-full min-h-[150px] text-foreground/80" />
            <EmbedsEditor embeds={[]} setEmbeds={setEmbeds} RichEmbed={() => <div />} />
          </div>
        )}

        <div className="flex flex-row pt-2 gap-1 overflow-x-auto no-scrollbar">
          {!isReply && !hideChannel && (
            <div className="text-foreground/80">
              <ChannelPicker
                disabled={isPublishing}
                getChannels={getChannels}
                getAllChannels={getAllChannels}
                // @ts-expect-error - mod protocol channel type mismatch
                onSelect={setChannel}
                // @ts-expect-error - mod protocol channel type mismatch
                value={getChannel()}
              />
            </div>
          )}
          <Button
            className="h-9 p-2"
            type="button"
            variant="outline"
            disabled={isPublishing}
            onClick={() => setCurrentMod(creationMods[0])}
          >
            <PhotoIcon className="w-5 h-5" />
            <span className="sr-only md:not-sr-only md:pl-2">Add image</span>
          </Button>
          <Popover
            open={!!currentMod}
            onOpenChange={(op: boolean) => {
              if (!op) setCurrentMod(null);
            }}
          >
            <PopoverTrigger></PopoverTrigger>
            <PopoverContent className="w-[300px]">
              <div className="space-y-4">
                <h4 className="font-medium leading-none">{currentMod?.name}</h4>
                <hr />
                <CreationMod
                  input={getText()}
                  embeds={getEmbeds()}
                  api={API_URL}
                  variant="creation"
                  manifest={currentMod!}
                  renderers={renderers}
                  onOpenFileAction={handleOpenFile}
                  onExitAction={() => setCurrentMod(null)}
                  onSetInputAction={handleSetInput(setText)}
                  onAddEmbedAction={handleAddEmbed(addEmbed)}
                />
              </div>
            </PopoverContent>
          </Popover>
          {textLengthWarning && <div className={cn('my-2 ml-2 text-sm', textLengthTailwind)}>{textLengthWarning}</div>}
          {onRemove && (
            <Button className="h-9" variant="outline" type="button" onClick={onRemove} disabled={isPublishing}>
              Remove
            </Button>
          )}
          {!hideSchedule &&
            (scheduleDateTime ? (
              <DateTimePicker
                granularity="minute"
                hourCycle={24}
                jsDate={scheduleDateTime}
                onJsDateChange={setScheduleDateTime}
                showClearButton
              />
            ) : (
              <Button
                className="h-9"
                type="button"
                variant="outline"
                disabled={isPublishing}
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 1);
                  setScheduleDateTime(date);
                }}
              >
                <CalendarDaysIcon className="mr-1 w-5 h-5" />
                Schedule
              </Button>
            ))}
        </div>
        <div className="flex flex-row pt-2 justify-between">
          <div>
            {scheduleDateTime && hasReachedFreePlanLimit && (
              <Link href="/upgrade" prefetch={false}>
                <Button variant="link" className="text-left px-0">
                  You reached the limit of scheduled casts. Upgrade ↗
                </Button>
              </Link>
            )}
          </div>
          <Button
            size="lg"
            type="submit"
            className="line-clamp-1 min-w-48 max-w-md truncate"
            disabled={isButtonDisabled}
          >
            {getButtonText()}
          </Button>
        </div>
      </form>

      {hasEmbeds && (
        <div className="mt-8 rounded-md bg-muted/50 p-2 w-full break-all">
          {map(draft.embeds, (embed) => (
            <div key={`cast-embed-${embed?.url || embed?.hash}`}>
              {renderEmbedForUrl({
                ...embed,
                onRemove: () => {
                  const newEmbeds = draft.embeds.filter((e) => e.url !== embed.url);
                  updatePostDraft(draftIdx, { ...draft, embeds: newEmbeds });
                  window.location.reload();
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
      if (file) {
        uploadImage(file);
        return true;
      }
    }
  }
  return false;
}
