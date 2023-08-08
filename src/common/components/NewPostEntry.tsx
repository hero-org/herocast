import React from "react";
import { Fragment, useState } from 'react'
import {
  FaceFrownIcon,
  FaceSmileIcon,
  FireIcon,
  HandThumbUpIcon,
  HeartIcon,
  PaperClipIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { Listbox, Transition } from '@headlessui/react'
import { classNames } from "@/common/helpers";
import { Tab } from '@headlessui/react';
import { AtSymbolIcon, CodeBracketIcon, LinkIcon } from '@heroicons/react/20/solid';

const channels = [
  { name: 'I feel nothing', value: null, icon: XMarkIcon, iconColor: 'text-gray-400', bgColor: 'bg-transparent' },
  { name: 'Excited', value: 'excited', icon: FireIcon, iconColor: 'text-white', bgColor: 'bg-red-500' },
  { name: 'Loved', value: 'loved', icon: HeartIcon, iconColor: 'text-white', bgColor: 'bg-pink-400' },
  { name: 'Happy', value: 'happy', icon: FaceSmileIcon, iconColor: 'text-white', bgColor: 'bg-green-400' },
  { name: 'Sad', value: 'sad', icon: FaceFrownIcon, iconColor: 'text-white', bgColor: 'bg-yellow-400' },
  { name: 'Thumbsy', value: 'thumbsy', icon: HandThumbUpIcon, iconColor: 'text-white', bgColor: 'bg-blue-500' },
]


export default function NewPostEntry({ draft, onTextChange, onSubmit }: { draft: any, onTextChange: (text: string) => void, onSubmit: () => void }) {
  const [selectedChannel, setSelectedChannel] = useState(null)

  return (
    <div className="flex items-start space-x-4">
      {/* <div className="flex-shrink-0">
        <img
          className="inline-block h-10 w-10 rounded-full"
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
          alt=""
        />
      </div> */}
      <div className="min-w-0 flex-1 w-96">
        <form onSubmit={onSubmit}>
          <Tab.Group>
            {({ selectedIndex }) => (
              <>
                <Tab.List className="flex items-center">
                  <Tab
                    className={({ selected }) =>
                      classNames(
                        selected
                          ? 'bg-gray-500 text-gray-100 hover:bg-gray-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-200',
                        'rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium'
                      )
                    }
                  >
                    Write
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      classNames(
                        selected
                          ? 'bg-gray-500 text-gray-100 hover:bg-gray-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-200',
                        'ml-1 rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium'
                      )
                    }
                  >
                    Preview
                  </Tab>

                  {/* These buttons are here simply as examples and don't actually do anything. */}
                  {selectedIndex === 0 ? (
                    <div className="ml-auto flex items-center space-x-2">
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-200 hover:text-gray-300"
                        >
                          <span className="sr-only">Insert link</span>
                          <LinkIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                      {/* <div className="flex items-center">
                        <button
                          type="button"
                          className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:text-gray-300"
                        >
                          <span className="sr-only">Insert code</span>
                          <CodeBracketIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div> */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-200 hover:text-gray-300"
                        >
                          <span className="sr-only">Mention someone</span>
                          <AtSymbolIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </Tab.List>
                <Tab.Panels className="mt-2">
                  <Tab.Panel className="-m-0.5 rounded-sm p-0.5">
                    <label htmlFor="comment" className="sr-only">
                      Comment
                    </label>
                    <div>
                      <textarea
                        rows={5}
                        name="comment"
                        id="comment"
                        className="block w-full rounded-sm border-0 py-2 bg-gray-700 text-gray-300 shadow-sm ring-1 ring-inset ring-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
                        placeholder="your cast..."
                        defaultValue={''}
                        value={draft.text}
                        onChange={(e) => onTextChange(e.target.value)}
                      />
                    </div>
                  </Tab.Panel>
                  <Tab.Panel className="-m-0.5 rounded-sm p-0.5">
                    <div className="border-b">
                      <div className="mx-px mt-px px-3 pb-24 pt-2 text-sm leading-5 bg-gray-600 text-gray-200">
                        {draft.text}
                      </div>
                    </div>
                  </Tab.Panel>
                </Tab.Panels>
              </>
            )}
          </Tab.Group>
          <div className="mt-2 flex justify-end">
            {/* <span className="mt-2 text-gray-400">posting to {selectedChannel ? `${selectedChannel.name} channel` : 'your mainfeed'}</span> */}
            <button
              type="submit"
              className="inline-flex items-center rounded-sm bg-zinc-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
