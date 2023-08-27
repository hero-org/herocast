import React, { Fragment, useEffect, useRef, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import { classNames } from "@/common/helpers/css";
import { CasterType, getCasterData } from "@/common/helpers/farcaster";
import { PostType } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { Listbox, Transition } from '@headlessui/react'
import { ChannelType, channels } from "@/common/constants/channels";
import isEmpty from "lodash.isempty";

const Item = ({ entity: { name, char } }) => <div className="bg-gray-100">{`${name}: ${char}`}</div>;
const Loading = ({ data }) => <div>Loading</div>;
const casterData = getCasterData();

const MentionDropdownItem = ({ entity, selected }) => {
  const { username, display_name } = entity;
  return (
    <div className={classNames(
      selected ? 'bg-radix-slate8' : 'bg-radix-slate10',
      "relative cursor-pointer select-none py-2 pl-3 pr-9"
    )}>
      <div className="flex text-radix-slate12">
        <span className={classNames('truncate font-semibold', selected && '')}>@{username}</span>
        <span
          className={classNames(
            'ml-2 truncate',
          )}
        >
          {display_name}
        </span>
      </div>
    </div>
  )
}

function findUsername(username: string): CasterType[] {
  return casterData.filter((caster: CasterType) =>
    caster.username?.startsWith(username) || caster.display_name?.startsWith(username)
  );
};

// const assignees = [
//   { name: 'Unassigned', value: null },
//   {
//     name: 'Wade Cooper',
//     value: 'wade-cooper',
//     avatar:
//       'https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
//   },
//   // More items...
// ]
// const labels = [
//   { name: 'Unlabelled', value: null },
//   { name: 'Engineering', value: 'engineering' },
//   // More items...
// ]


export default function NewPostEntry({ draft, onChange, onSubmit }: { draft: PostType, onChange: (cast: PostType) => void, onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaElement = textareaRef.current;
  const {
    selectedChannelIdx
  } = useAccountStore();

  const account = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const hasMultipleAccounts = useAccountStore((state) => state.accounts.length > 1);
  const channel = channels.find((channel: ChannelType) => channel.parent_url === draft.parentUrl);

  useEffect(() => {
    onChange({ ...draft, parentUrl: selectedChannelIdx !== null ? channels[selectedChannelIdx].parent_url : undefined });
  }, [selectedChannelIdx])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        onSubmit();
      }
    };
    if (textareaElement) {
      textareaElement.addEventListener("keydown", listener);
    }
    return () => {
      if (textareaElement) {
        textareaElement.removeEventListener("keydown", listener);
      }
    };
  }, [textareaElement, onSubmit]);

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
      dataProvider: (token: string) => {
        return findUsername(token.toLowerCase()).slice(0, 7)
      },
      component: MentionDropdownItem,
      output: (item, trigger) => `@${item.username}`
    }
  }

  const onUpdateParentUrl = (channel: ChannelType) => {
    const newParentUrl = (channel.parent_url === draft.parentUrl) ? undefined : channel.parent_url;
    onChange({ ...draft, parentUrl: newParentUrl })
  }

  return (
    <div className="flex flex-col items-start">
      <form onSubmit={(event) => onSubmit(event)} className="relative min-w-full">
        <div className="overflow-hidden rounded-sm ">
          <label htmlFor="new-post" className="sr-only">
            Your new post
          </label>
          <div ref={textareaRef}>
            <ReactTextareaAutocomplete
              value={draft.text}
              onChange={(e) => onChange({ ...draft, text: e.target.value })}
              containerClassName="relative"
              className="block w-full rounded-sm border-0 px-3 py-2 bg-gray-700 resize-none text-radix-slate2 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-0 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
              loadingComponent={Loading}
              minChar={1}
              rows={6}
              trigger={characterToTrigger}
              dropdownClassName="absolute z-10 -ml-4 mt-5 max-h-60 w-full overflow-auto rounded-sm bg-radix-slate10 py-1 text-gray-900 text-base shadow-sm ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            />
          </div>

          {/* Spacer element to match the height of the toolbar */}
          <div aria-hidden="true">
            <div className="py-2">
              <div className="h-8" />
            </div>
            <div className="h-px" />
            <div className="py-2">
              <div className="py-px">
                <div className="h-8" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-px bottom-0">
          {/* Actions: These are just examples to demonstrate the concept, replace/wire these up however makes sense for your project. */}
          <div className="flex flex-nowrap justify-start space-x-2 px-2 py-2 sm:px-3 bg-gray-700">
            <Listbox as="div" value={channel} onChange={(value) => onUpdateParentUrl(value)} className="flex-shrink-0">
              {({ open }) => (
                <>
                  <Listbox.Label className="sr-only">Channel</Listbox.Label>
                  <div className="relative w-96">
                    <Listbox.Button className="relative inline-flex items-center whitespace-nowrap rounded-lg bg-radix-slate10 px-2 py-1.5 text-sm font-medium text-radix-slate4 hover:bg-radix-slate9 sm:px-3">
                      {/* {assigned.value === null ? (
                        <UserCircleIcon className="h-5 w-5 flex-shrink-0 text-gray-300 sm:-ml-1" aria-hidden="true" />
                      ) : (
                        <img src={assigned.avatar} alt="" className="h-5 w-5 flex-shrink-0 rounded-full" />
                      )} */}
                      <span
                        className={classNames(
                          isEmpty(channel) ? '' : 'text-radix-slate2',
                          'truncate block'
                        )}
                      >
                        {isEmpty(channel) ? 'Channel' : channel.name}
                      </span>
                    </Listbox.Button>

                    <Transition
                      show={open}
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute left-0 z-100 mt-1 max-h-56 w-42 overflow-auto rounded-sm bg-radix-slate10 text-base shadow ring-1 ring-gray-900 focus:outline-none sm:text-sm">
                        {channels.map((channel) => (
                          <Listbox.Option
                            key={channel.parent_url}
                            className={({ active }) =>
                              classNames(
                                active ? 'bg-radix-slate8' : 'bg-radix-slate10',
                                'relative cursor-default select-none px-3 py-2 truncate'
                              )
                            }
                            value={channel}
                          >
                            <div className="flex items-center">
                              <span className=" block truncate font-medium">{channel.name}</span>
                            </div>
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox>

            {/* <Listbox as="div" value={dated} onChange={setDated} className="flex-shrink-0">
              {({ open }) => (
                <>
                  <Listbox.Label className="sr-only">Add a due date</Listbox.Label>
                  <div className="relative">
                    <Listbox.Button className="relative inline-flex items-center whitespace-nowrap rounded-full bg-gray-50 px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 sm:px-3">
                      <CalendarIcon
                        className={classNames(
                          dated.value === null ? 'text-gray-300' : 'text-gray-500',
                          'h-5 w-5 flex-shrink-0 sm:-ml-1'
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={classNames(
                          dated.value === null ? '' : 'text-gray-900',
                          'hidden truncate sm:ml-2 sm:block'
                        )}
                      >
                        {dated.value === null ? 'Due date' : dated.name}
                      </span>
                    </Listbox.Button>

                    <Transition
                      show={open}
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute right-0 z-10 mt-1 max-h-56 w-52 overflow-auto rounded-lg bg-white py-3 text-base shadow ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {dueDates.map((dueDate) => (
                          <Listbox.Option
                            key={dueDate.value}
                            className={({ active }) =>
                              classNames(
                                active ? 'bg-gray-100' : 'bg-white',
                                'relative cursor-default select-none px-3 py-2'
                              )
                            }
                            value={dueDate}
                          >
                            <div className="flex items-center">
                              <span className="block truncate font-medium">{dueDate.name}</span>
                            </div>
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox> */}
          </div>
          <div className="flex items-center justify-between space-x-3 mt-4">
            {/* <div className="flex">
              <button
                type="button"
                className="group -my-2 -ml-2 inline-flex items-center rounded-full px-3 py-2 text-left text-gray-400"
              >
                <PaperClipIcon className="-ml-1 mr-2 h-5 w-5 group-hover:text-gray-500" aria-hidden="true" />
                <span className="text-sm italic text-gray-500 group-hover:text-gray-600">Attach a file</span>
              </button>
            </div> */}
            <div className="flex-shrink-0">
              <button
                type="submit"
                className="inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-gray-700 hover:bg-gray-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
              >
                Post {hasMultipleAccounts && `as @${account.name}`} {!isEmpty(channel) && `in ${channel.name}`}
              </button>
            </div>
          </div>
        </div>
      </form>
      <div className="mt-4 border-l-4 border-yellow-200 bg-yellow-300/50 p-2 pr-3">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-200" aria-hidden="true" />
          </div>
          <div className="">
            <p className="text-sm text-yellow-200">
              this doesn't support embedding urls yet
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// <div className="min-w-0 flex-1 w-96">
//   <div>
//     <div className="mt-2">
//       <div className="-m-0.5 rounded-sm p-0.5">
//         <label htmlFor="comment" className="sr-only">
//           Comment
//         </label>
//         <div ref={textareaRef}>
//           <ReactTextareaAutocomplete
//             value={draft.text}
//             onChange={(e) => onTextChange(e.target.value)}
//             containerClassName="relative mt-2"
//             className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
//             loadingComponent={Loading}
//             minChar={1}
//             rows={5}
//             trigger={characterToTrigger}
//             dropdownClassName="absolute z-10 -ml-4 mt-5 max-h-60 w-full overflow-auto rounded-sm bg-radix-slate10 py-1 text-base shadow-sm ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
//           />
//         </div>
//       </div>
//     </div>
//   </div>
//   <div className="mt-2 flex justify-start">
//     <button
//       onClick={() => onSubmit()}
//       type="submit"
//       className="max-h-6inline-flex items-center rounded-sm bg-zinc-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
//     >
//       Post {hasMultipleAccounts && `as @${account.name}`}
//     </button>
//   </div>

// </div>


// <ReactTextareaAutocomplete
//   ref={textareaRef}
//   rows={5}
//   name="comment"
//   id="comment"
//   className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
//   placeholder="your cast..."
//   value={draft.text}
//   onChange={(e) => onTextChange(e.target.value)}
// />
