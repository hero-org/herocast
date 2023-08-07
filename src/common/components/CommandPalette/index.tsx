import React, { useEffect } from "react";
import { Fragment, useState } from 'react'
import { Combobox, Dialog, Transition } from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { DocumentPlusIcon, FolderPlusIcon, FolderIcon, HashtagIcon, TagIcon } from '@heroicons/react/24/outline'
import { useHotkeys } from 'react-hotkeys-hook'
import { classNames } from "@/common/helpers";
import { useNavigationStore } from "@/stores/useNavigationStore";

type ActionType = {
  name: string
  icon: React.ComponentType<{ className: string }>
  shortcut: string
  action: () => void
  searchTerms: string
}

export default function CommandPalette() {
  // const [isOpen, setCommandPaletteOpen] = useAtom(commandPaletteOpen)
  // const [mainNav, setMainNavigation] = useAtom(mainNavigationAtom)
  const [query, setQuery] = useState('')
  // const [selectedAction, setSelectedAction] = useState<ActionType>(null)

  const {
    isCommandPaletteOpen,
    toggleCommandPalette,
    toAddAccount,
    toReplies,
    toFeed,
    toNewPost,
    toSettings,
  } = useNavigationStore();

  // add hotkeys for all actions here by using useHotkeys repeatedly
  useHotkeys(['meta+k'], () => {
    toggleCommandPalette();
  }, [isCommandPaletteOpen], {
    enableOnFormTags: true,
  })

  useHotkeys(['c'], () => {
    toNewPost();
  }, [])

  useHotkeys(['shift+f'], () => {
    toFeed();
  }, [])

  useHotkeys(['shift+r'], () => {
    toReplies();
  }, [])

  useHotkeys(['meta+shift+a'], () => {
    toAddAccount();
  }, [])

  useHotkeys(['meta+,'], () => {
    toSettings();
  }, [])

  const actions: ActionType[] = [
    { name: 'Add Account', searchTerms: 'new add account', icon: DocumentPlusIcon, shortcut: 'cmd + shift + a', action: toAddAccount },
    { name: 'Switch to Feed.', searchTerms: 'feed scroll', icon: FolderPlusIcon, shortcut: 'F', action: toFeed },
    { name: 'Switch to Replies.', searchTerms: 'replies threads', icon: FolderIcon, shortcut: 'R', action: toReplies },
    { name: 'New Post...', searchTerms: 'new posts', icon: HashtagIcon, shortcut: 'c', action: toNewPost },
    { name: 'Settings...', searchTerms: 'settings preferences', icon: TagIcon, shortcut: 'cmd + ,', action: toSettings },
  ]

  // useEffect(() => {
  //   const listener = (event: KeyboardEvent) => {
  //     if (event.code === "Enter" || event.code === "NumpadEnter") {
  //       console.log("Enter key was pressed. Run your function.");
  //       event.preventDefault();
  //       onClick(selectedAction);
  //     }
  //   };
  //   document.addEventListener("keydown", listener);
  //   return () => {
  //     document.removeEventListener("keydown", listener);
  //   };
  // }, []);


  const onClick = (action: ActionType) => {
    if (!action) {
      return
    }
    action.action();
    toggleCommandPalette();
  }

  const filteredActions =
    query === ''
      ? []
      : actions.filter((action: ActionType) => {
        return action.searchTerms.includes(query.toLowerCase())
      })

  return (
    <Transition.Root show={isCommandPaletteOpen} as={Fragment} afterLeave={() => setQuery('')} appear>
      <Dialog as="div" className="relative z-10" onClose={toggleCommandPalette}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-10"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-10"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-zinc-500 bg-opacity-30 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-10"
            enterFrom="opacity-50 scale-98"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-10"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-98"
          >
            <Dialog.Panel className="mx-auto max-w-2xl transform divide-y divide-gray-500 divide-opacity-20 overflow-hidden rounded-md bg-gray-900 shadow-none transition-all">
              <Combobox onChange={(e: any) => {
                onClick(e)
              }}>
                <div className="relative">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-500"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-white focus:outline-none focus:ring focus:border-gray-500 sm:text-sm"
                    placeholder="Search Herocast..."
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                {(query === '' || filteredActions.length > 0) && (
                  <Combobox.Options
                    static
                    className="max-h-80 scroll-py-2 divide-y divide-gray-500 divide-opacity-20 overflow-y-auto"
                  >
                    {/* <li className="p-2">
                      <ul className="text-sm text-gray-400">
                        {(query !== '' && filteredActions.length > 0).map((action) => (
                          <Combobox.Option
                            key={action.id}
                            value={action.name}
                            className={({ active }) =>
                              classNames(
                                'flex cursor-default select-none items-center rounded-md px-3 py-2',
                                active && 'bg-gray-800 text-white'
                              )
                            }
                          >
                            {({ active }) => (
                              <>
                                <FolderIcon
                                  className={classNames('h-6 w-6 flex-none', active ? 'text-white' : 'text-gray-500')}
                                  aria-hidden="true"
                                />
                                <span className="ml-3 flex-auto truncate">{action.name}</span>
                                {active && <span className="ml-3 flex-none text-gray-400">Jump to...</span>}
                              </>
                            )}
                          </Combobox.Option>
                        ))}
                      </ul>
                    </li> */}
                    <li className="p-2">
                      <h2 className="sr-only">Quick actions</h2>
                      <ul className="text-sm text-gray-400">
                        {(filteredActions.length > 0 && filteredActions || actions).map((action) => (
                          <Combobox.Option
                            key={action.shortcut}
                            value={action}
                            onClick={() => onClick(action)}
                            className={({ active }) =>
                              classNames(
                                'flex cursor-default select-none items-center rounded-sm px-3 py-2',
                                active && 'bg-gray-800 text-white'
                              )
                            }
                          >
                            {({ active }) => (
                              <>
                                <action.icon
                                  className={classNames('h-6 w-6 flex-none', active ? 'text-white' : 'text-gray-500')}
                                  aria-hidden="true"
                                />
                                <span className="ml-3 flex-auto truncate">{action.name}</span>
                                <span className="ml-3 flex-none text-xs font-semibold text-gray-400">
                                  <kbd className="font-sans">⌘</kbd>
                                  <kbd className="font-sans">{action.shortcut}</kbd>
                                </span>
                              </>
                            )}
                          </Combobox.Option>
                        ))}
                      </ul>
                    </li>

                  </Combobox.Options>
                )}

                {query !== '' && filteredActions.length === 0 && (
                  <div className="px-6 py-14 text-center sm:px-14">
                    <FolderIcon className="mx-auto h-6 w-6 text-gray-500" aria-hidden="true" />
                    <p className="mt-4 text-sm text-gray-200">
                      no actions found
                    </p>
                  </div>
                )}
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
