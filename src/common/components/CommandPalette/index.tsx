import React, { Fragment, useState } from 'react';
import { channels } from "@/common/constants/channels";
import { CommandType } from "@/common/constants/commands";
import { classNames } from "@/common/helpers/css";
import { accountCommands, channelCommands, useAccountStore } from '@/stores/useAccountStore';
import { useNavigationStore } from "@/stores/useNavigationStore";
import { newPostCommands } from "@/stores/useNewPostStore";
import { Combobox, Dialog, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { BellIcon, FaceSmileIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import commandScore from "command-score";
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from "react-router-dom";
import { Bars3BottomLeftIcon } from "@heroicons/react/20/solid";
import { Cog6ToothIcon, UserPlusIcon } from "@heroicons/react/24/outline";

const MIN_SCORE_THRESHOLD = 0.0015;

export const getNavigationCommands = (navigate?: (path: string) => void | null): CommandType[] => (
  [
    {
      name: 'Accounts',
      aliases: ['new account', 'sign up'],
      icon: UserPlusIcon,
      shortcut: 'cmd+shift+a',
      enableOnFormTags: true,
      action: () => navigate && navigate('/accounts'),
    },
    {
      name: 'Switch to Feed',
      aliases: ['scroll',],
      icon: Bars3BottomLeftIcon,
      shortcut: 'shift+f',
      enableOnFormTags: false,
      action: () => navigate && navigate('/feed'),
    },
    {
      name: 'Switch to Search',
      aliases: ['search',],
      icon: MagnifyingGlassIcon,
      shortcut: '/',
      enableOnFormTags: false,
      action: () => navigate && navigate('/search'),
    },
    {
      name: 'New post',
      aliases: ['new tweet', 'write', 'create', 'compose',],
      icon: PlusCircleIcon,
      shortcut: 'c',
      enableOnFormTags: false,
      action: () => navigate && navigate('/post'),
    },
    {
      name: 'Notifications',
      aliases: ['notify', 'alert', 'mentions', 'replies', 'messages', 'inbox',],
      icon: BellIcon,
      shortcut: 'shift+n',
      enableOnFormTags: false,
      action: () => navigate && navigate('/notifications'),
    },
    {
      name: 'Settings',
      aliases: ['preferences', 'options', 'config',],
      icon: Cog6ToothIcon,
      shortcut: 'cmd+shift+,',
      enableOnFormTags: true,
      action: () => navigate && navigate('/settings'),
    },
  ]
)

export default function CommandPalette() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('')

  const {
    isCommandPaletteOpen,
    closeCommandPallete,
    toggleCommandPalette,
  } = useNavigationStore();

  const {
    setCurrentChannelIdx
  } = useAccountStore();

  useHotkeys(['meta+k'], () => {
    toggleCommandPalette();
  }, [isCommandPaletteOpen], {
    enableOnFormTags: true,
  })


  const navigationCommands = getNavigationCommands(navigate);

  let commands: CommandType[] = [
    ...navigationCommands,
    ...newPostCommands,
    ...accountCommands,
    ...channelCommands,
  ];

  for (const command of commands) {
    useHotkeys(command.shortcut.replace('cmd', 'meta'), () => {
      if (command.navigateTo) {
        navigate(command.navigateTo);
      }
      command.action();
    }, [], {
      enableOnFormTags: command.enableOnFormTags,
      splitKey: '-',
      enabled: command.enabled || true, // this obv doesn't work
    })
  }

  const nonHotkeyCommands: CommandType[] = [];
  channels.map((c) => c.name).map((channelName: string, idx: number) => {
    nonHotkeyCommands.push({
      name: channelName,
      action: () => {
        setCurrentChannelIdx(idx);
      },
      shortcut: '',
      aliases: [],
      enableOnFormTags: false,
    });
  });
  commands = commands.concat(nonHotkeyCommands);

  function onClick(command: CommandType) {
    // console.log('onClick command', command);
    if (!command) {
      return;
    }
    if (command.navigateTo) {
      navigate(command.navigateTo);
    }
    command.action();
    closeCommandPallete();
  }


  const getFilteredCommands = () => {
    return commands.map((command: CommandType) => {
      const scores = [command.name, ...command.aliases].map((alias: string) => {
        return commandScore(alias, query);
      });
      return {
        ...command,
        score: Math.max(...scores),
      }
    }).filter((command: CommandType & { score: number }) => {
      return command.score > MIN_SCORE_THRESHOLD;
    }).slice(0, 7);
  }

  const filteredCommands =
    query === '' ? [] : getFilteredCommands();

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
              <Combobox onChange={(e: any) => { onClick(e) }}>
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

                {(query === '' || filteredCommands.length > 0) && (
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
                        {(filteredCommands.length > 0 && filteredCommands || commands.slice(0, 7)).map((action) => (
                          <Combobox.Option
                            key={action.name}
                            value={action}
                            onClick={() => onClick(action)}
                            className={({ active }) =>
                              classNames(
                                'flex cursor-default select-none items-center rounded-sm px-3 py-2',
                                active ? 'bg-gray-800 text-white' : ''
                              )
                            }
                          >
                            {({ active }) => (
                              <>
                                {action.icon && <action.icon
                                  className={classNames('h-6 w-6 flex-none', active ? 'text-white' : 'text-gray-500')}
                                  aria-hidden="true"
                                />}
                                <span className="ml-3 flex-auto truncate">
                                  {action.name}
                                  {/* {action.score && `(${action.score})`} */}
                                </span>
                                <span className="ml-3 flex-none text-xs font-semibold text-gray-400">
                                  {/* <kbd className="font-sans">⌘</kbd> */}
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

                {query !== '' && filteredCommands.length === 0 && (
                  <div className="px-6 py-14 text-center sm:px-14">
                    <FaceSmileIcon className="mx-auto h-6 w-6 text-gray-500" aria-hidden="true" />
                    <p className="mt-4 text-sm text-gray-200">
                      nothing found - submit feedback if something should be here
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
