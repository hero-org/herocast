import React, { useEffect } from "react";
import { NewPostDraft, useNewPostStore } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { DraftType } from "../constants/farcaster";
import { useHotkeys } from "react-hotkeys-hook";
import { useEditor, EditorContent, Editor } from "@mod-protocol/react-editor";
import { EmbedsEditor } from "@mod-protocol/react-ui-shadcn/dist/lib/embeds";
import {
  fetchUrlMetadata,
} from "@mod-protocol/core";
import {
  Channel,
  getFarcasterChannels,
  getFarcasterMentions,
} from "@mod-protocol/farcaster";
import { createRenderMentionsSuggestionConfig } from "@mod-protocol/react-ui-shadcn/dist/lib/mentions";
import { CastLengthUIIndicator } from "@mod-protocol/react-ui-shadcn/dist/components/cast-length-ui-indicator";
import { ChannelPicker } from "@mod-protocol/react-ui-shadcn/dist/components/channel-picker";
import uniqBy from "lodash.uniqby";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_MOD_PROTOCOL_API_URL!;
const getResults = getFarcasterMentions(API_URL);
const getModChannels = getFarcasterChannels(API_URL);
const getUrlMetadata = fetchUrlMetadata(API_URL);

const onError = (err) => {
  console.error(err);
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "development") {
    window.alert(err.message);
  }
};

type NewPostEntryProps = {
  draftIdx: number;
  onPost?: () => void;
  hideChannel?: boolean;
  disableAutofocus?: boolean;
};

export default function NewPostEntry({
  draftIdx,
  onPost,
  hideChannel,
}: NewPostEntryProps) {
  const { drafts, updatePostDraft, publishPostDraft } =
    useNewPostStore();

  const { allChannels: channels } = useAccountStore();
  const draft = draftIdx !== null ? drafts[draftIdx] : NewPostDraft;

  const getChannels = async (query: string): Promise<Channel[]> => {
    const modChannels = await getModChannels(query);
    const filteredChannels = (
      query === ""
        ? channels
        : channels.filter((channel) => {
            return channel.name.toLowerCase().includes(query.toLowerCase());
          })
    ).map(
      (channel) =>
        ({
          channel_id: channel.id,
          parent_url: channel.url,
          name: channel.name,
          image: channel.icon_url || "",
        } as Channel)
    );

    return uniqBy([...filteredChannels, ...modChannels], "parent_url");
  };

  const account = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const hasMultipleAccounts = useAccountStore(
    (state) => state.accounts.length > 1
  );
  const isReply = draft?.parentCastId !== undefined;

  const onChange = (cast: DraftType) => {
    updatePostDraft(draftIdx, cast);
  };

  const onSubmitPost = async (): Promise<boolean> => {
    console.log('onSubmitPost')
    if (draft.text.length > 0) {
      await new Promise(() => publishPostDraft(draftIdx, account, onPost));
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
    getEmbeds,
    setEmbeds,
    setChannel,
    getChannel,
    handleSubmit,
  } = useEditor({
    fetchUrlMetadata: getUrlMetadata,
    onError,
    onSubmit: onSubmitPost,
    linkClassName: "text-blue-300",
    renderMentionsSuggestionConfig: createRenderMentionsSuggestionConfig({
      getResults: getResults,
    }),
  });

  const text = getText();
  const embeds = getEmbeds();
  useEffect(() => {
    onChange({
      ...draft,
      text,
      embeds,
    });
  }, [text, embeds]);

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
            className="w-full h-full min-h-[150px] text-gray-100"
          />
          <EmbedsEditor
            embeds={[]}
            setEmbeds={setEmbeds}
            RichEmbed={() => <div />}
          />
        </div>
        <div className="flex flex-row pt-2 gap-1">
          {!isReply && !hideChannel && (
            <div className="text-gray-200">
            <ChannelPicker
              getChannels={getChannels}
              onSelect={setChannel}
              value={getChannel()}
            />
            </div>
          )}
          <CastLengthUIIndicator getText={getText} />
          <div className="grow"></div>
          <Button type="submit">Cast</Button>
        </div>
      </form>
    </div>
  );
}
