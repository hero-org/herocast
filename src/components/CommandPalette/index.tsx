import React, { useEffect } from "react";
import { Fragment, useState } from 'react'
import { Combobox, Dialog, Transition } from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { DocumentPlusIcon, FolderPlusIcon, FolderIcon, HashtagIcon, TagIcon } from '@heroicons/react/24/outline'
import { useHotkeys } from 'react-hotkeys-hook'
import { atom, useAtom } from 'jotai'
import { classNames } from "@src/utils";
import { MAIN_NAVIGATION_ATOM_KEY, MAIN_NAVIGATION_ENUM, atomWithLocalStorage, mainNavigationAtom } from "@src/state";

const commandPaletteOpen = atom(false)
type ActionType = {
  name: string
  icon: React.ComponentType<{ className: string }>
  shortcut: string
  action: () => void
}

const projects = [
  { id: 1, name: 'Workflow Inc. / Website Redesign', url: '#' },
  // More projects...
]
const recent = []; //[projects[0]]

export default function CommandPalette() {
  const [isOpen, setCommandPaletteOpen] = useAtom(commandPaletteOpen)
  const [mainNav, setMainNavigation] = useAtom(mainNavigationAtom)
  const [query, setQuery] = useState('')
  const [selectedAction, setSelectedAction] = useState<ActionType>(null)

  console.log(`selectedAction: ${selectedAction && selectedAction.name} mainNav: ${mainNav}`)

  // add hotkeys for all actions here by using useHotkeys repeatedly
  useHotkeys(['meta+k'], () => {
    setCommandPaletteOpen(!isOpen);
  }, [isOpen], {
    enableOnFormTags: true,
  })

  const actions: ActionType[] = [
    { name: 'Add Account', icon: DocumentPlusIcon, shortcut: 'N', action: () => setMainNavigation(MAIN_NAVIGATION_ENUM.ADD_ACCOUNT), },
    { name: 'Switch to Feed.', icon: FolderPlusIcon, shortcut: 'F', action: () => setMainNavigation(MAIN_NAVIGATION_ENUM.FEED) },
    { name: 'Add hashtag...', icon: HashtagIcon, shortcut: 'H', action: () => null },
    { name: 'Add label...', icon: TagIcon, shortcut: 'L', action: () => null },
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
    console.log(`clicked ${action.name}`)
    if (!action) {
      return
    }
    action.action()
    setCommandPaletteOpen(false)
  }

  const filteredProjects =
    query === ''
      ? []
      : projects.filter((project) => {
        return project.name.toLowerCase().includes(query.toLowerCase())
      })

  return (
    <Transition.Root show={isOpen} as={Fragment} afterLeave={() => setQuery('')} appear>
      <Dialog as="div" className="relative z-10" onClose={setCommandPaletteOpen}>
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
                console.log('onChange', e);
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

                {(query === '' || filteredProjects.length > 0) && (
                  <Combobox.Options
                    static
                    className="max-h-80 scroll-py-2 divide-y divide-gray-500 divide-opacity-20 overflow-y-auto"
                  >
                    <li className="p-2">
                      {query === '' && (
                        <h2 className="mb-2 mt-4 px-3 text-xs font-semibold text-gray-200">Recent searches</h2>
                      )}
                      <ul className="text-sm text-gray-400">
                        {(query === '' ? recent : filteredProjects).map((project) => (
                          <Combobox.Option
                            key={project.id}
                            value={project}
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
                                <span className="ml-3 flex-auto truncate">{project.name}</span>
                                {active && <span className="ml-3 flex-none text-gray-400">Jump to...</span>}
                              </>
                            )}
                          </Combobox.Option>
                        ))}
                      </ul>
                    </li>
                    {query === '' && (
                      <li className="p-2">
                        <h2 className="sr-only">Quick actions</h2>
                        <ul className="text-sm text-gray-400">
                          {actions.map((action) => (
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
                    )}
                  </Combobox.Options>
                )}

                {query !== '' && filteredProjects.length === 0 && (
                  <div className="px-6 py-14 text-center sm:px-14">
                    <FolderIcon className="mx-auto h-6 w-6 text-gray-500" aria-hidden="true" />
                    <p className="mt-4 text-sm text-gray-200">
                      We couldn't find any projects with that term. Please try again.
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
