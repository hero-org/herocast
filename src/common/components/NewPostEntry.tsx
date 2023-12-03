import React, { useEffect } from "react";
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import { classNames } from "@/common/helpers/css";
import { NewPostDraft, useNewPostStore } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { Combobox } from '@headlessui/react'
import { ChannelType } from "@/common/constants/channels";
import isEmpty from "lodash.isempty";
import { AuthorType, DraftStatus, DraftType } from "../constants/farcaster";
import { CasterType, getNeynarUserSearchEndpoint } from "../helpers/neynar";
import { Loading } from "./Loading";
import { useHotkeys } from "react-hotkeys-hook";
import * as Tooltip from '@radix-ui/react-tooltip';
import HotkeyTooltipWrapper from "./HotkeyTooltipWrapper";
import ChannelsDropdown from "./ChannelsDropdown";
import { Progress } from "@/components/ui/progress";
import * as linkify from "linkifyjs";
import { registerPlugin } from 'linkifyjs';
import mention from "../helpers/linkify";

registerPlugin('mention', mention);


// const Item = ({ entity: { name, char } }) => <span className="bg-gray-100">{`${name}: ${char}`}</span>;

const MAX_CAST_LENGTH = 320; // 320 bytes

const MentionDropdownItem = ({ entity, selected }: { entity: AuthorType, selected: boolean }) => {
  const { username, display_name, pfp: { url: pfpUrl } } = entity;
  return (<Combobox.Option
    as="div"
    key={`mention-option-${username}`}
    value={entity}
    className={({ active }) =>
      classNames(
        'relative cursor-default select-none py-2 pl-3 pr-9',
        active ? 'bg-gray-600 text-gray-100' : 'bg-gray-700 text-gray-300'
      )
    }
  >
    {({ active, selected }) => (
      <>
        <div className="flex items-center">
          <img
            className="h-6 w-6 flex-shrink-0 border border-gray-600 rounded-lg"
            src={pfpUrl}
            alt=""
          />
          <div className="ml-2 flex">
            <span className="truncate font-semibold">@{username}</span>
            <span
              className={classNames(
                'ml-1 truncate',
              )}
            >
              {display_name}
            </span>
          </div>
        </div>
      </>
    )}
  </Combobox.Option>
  )
}

type NewPostEntryProps = {
  draftIdx: number;
  onPost?: () => void;
  hideChannel?: boolean;
  disableAutofocus?: boolean;
}

export default function NewPostEntry({ draftIdx, onPost, hideChannel, disableAutofocus }: NewPostEntryProps) {
  const {
    drafts,
    updatePostDraft,
    publishPostDraft,
    updateMentionsToFids,
  } = useNewPostStore();

  const {
    allChannels: channels
  } = useAccountStore();

  const [textLengthBytes, setTextLengthBytes] = React.useState(0);
  const draft = draftIdx !== null ? drafts[draftIdx] : NewPostDraft;
  const isWritingDraft = draft && (draft.status === DraftStatus.writing);
  const isPendingPublish = draft && (draft.status === DraftStatus.publishing);

  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleAccounts = useAccountStore((state) => state.accounts.length > 1);
  const channel = channels.find((channel: ChannelType) => channel.url === draft?.parentUrl);
  const isReply = draft?.parentCastId !== undefined;

  const onChange = (cast: DraftType) => {
    updatePostDraft(draftIdx, cast);

    if (!cast.text) {
      updateMentionsToFids(draftIdx, {});
    }
  };

  const neynarSearchEndpoint = getNeynarUserSearchEndpoint(account?.platformAccountId);
  const findUsername = async (username: string): Promise<CasterType[]> => {
    const res: CasterType[] = await fetch(`${neynarSearchEndpoint}&q=${username}`)
      .then((response) => response.json())
      .then((data) => {
        return data.result.users as CasterType[];
      }).catch((err) => {
        console.log('error fetching usernames', err);
        return [];
      });
    return res;
  };

  useEffect(() => {
    let text = draft?.text || '';
    const links = linkify.find(text, 'mention');
    if (links) {
      links.forEach((link) => {
        text = text.replace(link.value, '  ');
      });
    }
    // const len = new Buffer([text]).size;
    const len = new TextEncoder().encode(text).length

    setTextLengthBytes(len)
  }, [draft?.text]);

  const numNewlines = draft?.text ? draft.text.split('\n').length : 0;
  const ratio = (textLengthBytes / MAX_CAST_LENGTH) * 100;

  const onSubmitPost = async () => {
    // console.log('onSubmitPost', draft)
    if (!draft || !account.privateKey || !account.platformAccountId || ratio > 99) return;

    if (draft.text.length > 0) {
      await new Promise(() => publishPostDraft(draftIdx, account, onPost));
    }
  }

  const ref = useHotkeys('meta+enter', onSubmitPost, [draft, account, ratio], { enableOnFormTags: true });

  const characterToTrigger = {
    // ":": {
    //   dataProvider: token => {
    //     return emoji(token)
    //       .slice(0, 5)
    //       .map(({ name, char }) => ({ name, char }));
    //   },
    //   component: Item,
    //   output: (item, trigger) => item.char
    // },
    "@": {
      dataProvider: async (token: string) => {
        return await findUsername(token.toLowerCase());
      },
      component: MentionDropdownItem,
      output: (item, trigger) => `@${item.username}`
    }
  }

  const onUpdateParentUrl = (channel: ChannelType) => {
    console.log('onUpdateParentUrl', channel?.name)
    const newParentUrl = (channel.url === draft.parentUrl) ? undefined : channel.url;
    onChange({ ...draft, parentUrl: newParentUrl })
  }

  const onItemSelected = ({ draft, trigger, item }: { draft: DraftType, trigger: string, item: { username: string, fid: string } }) => {
    if (!item) return;

    if (trigger === '@') {
      if (!draft.mentionsToFids) {
        updateMentionsToFids(draftIdx, { [item?.username]: item?.fid })
      } else {
        updateMentionsToFids(draftIdx, { ...draft.mentionsToFids, [item?.username]: item?.fid })
      }
    }
  }

  const showToolbar = !hideChannel;

  const renderButtonText = () => {
    if (!draft) return 'Post';

    switch (draft.status) {
      case DraftStatus.writing:
        return `Post${hasMultipleAccounts ? ` as @${account.name}` : ''} ${!isEmpty(channel) && !hideChannel ? ` in ${channel.name.length > 10 ? 'channel' : channel.name}` : ''}`;
      case DraftStatus.publishing:
        return 'Posting...';
      case DraftStatus.published:
        return 'Posted';
      default:
        return 'Post';
    }
  }

  if (!draft) return null;

  const renderCastLengthProgressBar = () => {
    if (ratio < 60) return null;
    if (ratio > 99) {
      return <span className="text-md text-gray-300">Cast is too long</span>
    }
    return (
      <div className="flex items-center">
        {ratio > 90 && (<span className="mr-1.5 text-md text-gray-300">{MAX_CAST_LENGTH - textLengthBytes - 3} left</span>)}
        <Progress
          value={ratio}
          className="w-16 h-2"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start" ref={ref} tabIndex={-1}>
      <form
        className="relative min-w-full rounded-lg m-1 border border-gray-500"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitPost();
        }}
      >
        <div className="">
          <label htmlFor="new-post" className="sr-only">
            Your new post
          </label>
          <div>
            <Combobox as="div">
              <ReactTextareaAutocomplete
                autoFocus={!disableAutofocus}
                value={draft?.text || ''}
                onChange={(e) => onChange({ ...draft, text: e.target.value })}
                containerClassName="relative rounded-sm"
                className={classNames(
                  showToolbar ? 'rounded-t-md' : 'rounded-md',
                  "block border-1 border-gray-600 w-full px-3 py-2 bg-gray-700 ring-0 ring-gray-800 resize-none text-gray-200 placeholder:text-gray-400 sm:text-sm sm:leading-6 focus:outline-none focus:ring-0 focus:border-gray-500"
                )}
                style={{ minHeight: '100px' }}
                loadingComponent={() => <Loading />}
                placeholder={isReply ? 'your reply...' : `say something nice${channel ? ` in the ${channel.name} channel` : ''}, ${account?.name}`}
                minChar={2}
                rows={Math.max(numNewlines, hideChannel ? 2 : 4)}
                trigger={characterToTrigger}
                dropdownClassName="absolute z-10 mt-1 max-h-56 w-full overflow-show rounded-sm bg-gray-700 text-base shadow-md ring-1 ring-gray-200 ring-opacity-5 focus:outline-none sm:text-sm"
                onItemSelected={({ currentTrigger, item }) => onItemSelected({ trigger: currentTrigger, draft, item })}
              />
            </Combobox>
          </div>

          {/* Spacer element to match the height of the toolbar */}
          <div aria-hidden="true" className="ring-0 ring-gray-800">
            {showToolbar && (<div className="py-0">
              <div className="h-8" />
            </div>)}
            <div className="h-px" />
            <div className="py-2">
              <div className="py-px">
                <div className="h-8" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0">
          {/* Actions: These are just examples to demonstrate the concept, replace/wire these up however makes sense for your project. */}
          {showToolbar && (
            <div className="flex flex-nowrap justify-end items-center space-x-2 px-2 py-2 sm:px-3 bg-gray-700 rounded-b-md border border-gray-600">
              {renderCastLengthProgressBar()}
              {!hideChannel && (
                <ChannelsDropdown selectedChannel={channel} onChange={onUpdateParentUrl} />
              )}
            </div>)}
          <div className="flex items-center justify-end mt-4">
            <div className="flex-shrink-0">
              <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
                <HotkeyTooltipWrapper hotkey="Cmd + Enter" side="right">
                  <button
                    type="submit"
                    disabled={!isWritingDraft || ratio > 99}
                    className={classNames(
                      isWritingDraft || ratio > 99 ? 'bg-gray-700 cursor-disabled' : 'cursor-pointer',
                      "m-1 inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-gray-700 hover:bg-gray-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
                    )}
                  >
                    {renderButtonText()}
                  </button>
                </HotkeyTooltipWrapper>
              </Tooltip.Provider>
            </div>
          </div>
          {/* {draft.text && (
            <div className="mt-4 border-l-4 border-gray-200 bg-gray-300/50 p-2 pr-3">
              <div className="flex">
                <p className="ml-1 text-sm text-gray-200 flex-col">
                  embeds:
                  {getUrlsInText(draft.text).map((url) => (
                    <span key={`text-url-${url}`} className="ml-2">
                      {url}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )} */}
        </div>
      </form >
    </div >
  )
}
