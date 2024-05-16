import React, { useEffect } from "react";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { DraftType } from "../constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import { useEditor, EditorContent } from "@mod-protocol/react-editor";
import { EmbedsEditor } from "@mod-protocol/react-ui-shadcn/dist/lib/embeds";
import {
  ModManifest,
  fetchUrlMetadata,
  handleAddEmbed,
  handleOpenFile,
  handleSetInput,
} from "@mod-protocol/core";
import { getFarcasterMentions } from "@mod-protocol/farcaster";
import { createRenderMentionsSuggestionConfig } from "@mod-protocol/react-ui-shadcn/dist/lib/mentions";
import { CastLengthUIIndicator } from "@mod-protocol/react-ui-shadcn/dist/components/cast-length-ui-indicator";
import debounce from "lodash.debounce";
import { Button } from "@/components/ui/button";
import { MentionList } from "@mod-protocol/react-ui-shadcn/dist/components/mention-list";
import { take } from "lodash";
import { ChannelPicker } from "./ChannelPicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CreationMod } from "@mod-protocol/react";
import { creationMods } from "@mod-protocol/mod-registry";
import { renderers } from "@mod-protocol/react-ui-shadcn/dist/renderers";
import map from "lodash.map";
import { renderEmbedForUrl } from "./Embeds";
import { PhotoIcon } from "@heroicons/react/20/solid";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ChannelList } from "./ChannelList";
import isEmpty from "lodash.isempty";

const API_URL = process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!;
const getMentions = getFarcasterMentions(API_URL);
const debouncedGetMentions = debounce(getMentions, 200, {
  leading: true,
  trailing: false,
});
const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

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
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "development") {
    window.alert(err.message);
  }
};

type NewPostEntryProps = {
  draft?: DraftType;
  draftIdx: number;
  onPost?: () => void;
  hideChannel?: boolean;
  disableAutofocus?: boolean;
};

export default function NewPostEntry({
  draft,
  draftIdx,
  onPost,
  hideChannel,
}: NewPostEntryProps) {
  const { updatePostDraft, publishPostDraft } = useNewPostStore();
  const [currentMod, setCurrentMod] = React.useState<ModManifest | null>(null);
  const hasEmbeds = draft?.embeds && draft.embeds.length > 0;
  const [initialText, setInitialText] = React.useState<string>();

  useEffect(() => {
    if (draft?.text && isEmpty(draft.mentionsToFids)) {
      setInitialText(draft.text);
    }
  }, []);
  // const getChannels = async (query: string): Promise<Channel[]> => {
  //   const modChannels =
  //     query && query.length > 2
  //       ? await debouncedGetModChannels(query, true)
  //       : [];
  //   return take(modChannels, 10);
  // };

  const account = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const isReply = draft?.parentCastId !== undefined;

  const onSubmitPost = async (): Promise<boolean> => {
    if (draft?.text && draft.text.length > 0) {
      await publishPostDraft(draftIdx, account, onPost);
      return true;
    }
    return false;
  };

  const ref = useHotkeys("meta+enter", onSubmitPost, [draft, account], {
    enableOnFormTags: true,
  });

  if (!draft) return null;

  const {
    editor,
    getText,
    addEmbed,
    getEmbeds,
    setEmbeds,
    setChannel,
    getChannel,
    handleSubmit,
    setText,
  } = useEditor({
    initialText,
    fetchUrlMetadata: getUrlMetadata,
    onError,
    onSubmit: onSubmitPost,
    linkClassName: "text-blue-300",
    renderChannelsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: getChannels,
      RenderList: ChannelList,
    }),
    renderMentionsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: debouncedGetMentions,
      RenderList: MentionList,
    }),
  });

  const text = getText();
  const embeds = getEmbeds();
  const channel = getChannel();

  useEffect(() => {
    updatePostDraft(draftIdx, {
      ...draft,
      text,
      embeds,
      parentUrl: channel?.parent_url || undefined,
    });
  }, [text, embeds, channel]);

  return (
    <div
      className="flex flex-col items-start min-w-full w-full h-full"
      ref={ref}
      tabIndex={-1}
    >
      <form onSubmit={handleSubmit} className="w-full">
        <div className="p-2 border-slate-200 rounded-md border">
          <EditorContent
            editor={editor}
            autoFocus
            className="w-full h-full min-h-[150px] text-foreground/80"
          />
          <EmbedsEditor
            embeds={[]}
            setEmbeds={setEmbeds}
            RichEmbed={() => <div />}
          />
        </div>
        <div className="flex flex-row pt-2 gap-1">
          {!isReply && !hideChannel && (
            <div className="text-foreground/80">
              <ChannelPicker
                getChannels={getChannels}
                getAllChannels={getAllChannels}
                onSelect={setChannel}
                value={getChannel()}
              />
            </div>
          )}
          <Popover
            open={!!currentMod}
            onOpenChange={(op: boolean) => {
              if (!op) setCurrentMod(null);
            }}
          >
            <PopoverTrigger></PopoverTrigger>
            <PopoverContent className="w-[400px]" align="start">
              <div className="space-y-4">
                <h4 className="font-medium leading-none">{currentMod?.name}</h4>
                <hr />
                <CreationMod
                  input={getText()}
                  embeds={getEmbeds()}
                  api={API_URL}
                  variant="creation"
                  manifest={currentMod}
                  renderers={renderers}
                  onOpenFileAction={handleOpenFile}
                  onExitAction={() => setCurrentMod(null)}
                  onSetInputAction={handleSetInput(setText)}
                  onAddEmbedAction={handleAddEmbed(addEmbed)}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={() => setCurrentMod(creationMods[0])}
          >
            <PhotoIcon className="mr-1 w-5 h-5" />
            Add
          </Button>
          <CastLengthUIIndicator getText={getText} />
          <div className="grow"></div>
          <Button variant="outline" onClick={onPost}>
            Remove
          </Button>
          <Button type="submit" className="line-clamp-1 w-40 truncate">
            Cast{account ? ` as ${account.name}` : ""}
          </Button>
        </div>
      </form>
      {hasEmbeds && (
        <div className="mt-8 rounded-md bg-muted px-4 max-w-xl break-all">
          {map(draft.embeds, (embed) => (
            <div key={`cast-embed-${embed.url}`}>
              {renderEmbedForUrl(embed)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
