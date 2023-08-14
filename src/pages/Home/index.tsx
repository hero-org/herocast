import React, { Suspense } from "react";
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ChartBarSquareIcon,
  Cog6ToothIcon, SignalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon, PlusCircleIcon, UserPlusIcon } from '@heroicons/react/20/solid';
import { classNames } from "@/common/helpers/css";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { MAIN_NAVIGATION_ENUM, MAIN_NAVIGATION_TO_PAGE, RIGHT_SIDEBAR_ENUM } from "@/common/constants/navigation";
import CommandPalette from "@/common/components/CommandPalette";
import AccountsRightSidebar from "@/common/components/RightSidebar/AccountsRightSidebar";
import ChannelsRightSidebar from "@/common/components/RightSidebar/ChannelsRightSidebar";
import EmptyRightSidebar from "@/common/components/RightSidebar/EmptyRightSidebar";
import LoginModal from "@/common/components/LoginModal";
import { useAccountStore } from "@/stores/useAccountStore";
import Feed from "../Feed";
import { ChannelType, channels } from "@/common/constants/channels";

// const Feed = React.lazy(() =>
//   import('@/pages/Feed'),
// );
// const NewPost = React.lazy(() =>
//   import('@/pages/NewPost'),
// );
// const Replies = React.lazy(() =>
//   import('@/pages/Replies'),
// );
const Settings = React.lazy(() =>
  import('@/pages/Settings'),
);
const Accounts = React.lazy(() =>
  import('@/pages/Accounts'),
);

const myChannels = channels.slice(0, 10);
console.log('myChannels', myChannels);

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    mainNavigation,
    toAccounts,
    toReplies,
    toFeed,
    toNewPost,
    toSettings,
  } = useNavigationStore();

  const navigation = [
    { name: 'Feed', icon: SignalIcon, onClick: toFeed },
    // { name: 'Replies', icon: ChartBarSquareIcon, onClick: toReplies },
    // { name: 'New Post', icon: PlusCircleIcon, onClick: toNewPost },
    { name: 'Accounts', icon: UserPlusIcon, onClick: toAccounts },
    { name: 'Settings', icon: Cog6ToothIcon, onClick: toSettings },
  ]
  const pageNavigation = MAIN_NAVIGATION_TO_PAGE[mainNavigation];
  const title = pageNavigation.title;

  const renderContent = () => {
    switch (mainNavigation) {
      case MAIN_NAVIGATION_ENUM.FEED:
        return <Feed />
      // case MAIN_NAVIGATION_ENUM.REPLIES:
      //   return <Replies />
      // case MAIN_NAVIGATION_ENUM.NEW_POST:
      //   return <NewPost />
      case MAIN_NAVIGATION_ENUM.ACCOUNTS:
        return <Accounts />
      case MAIN_NAVIGATION_ENUM.SETTINGS:
        return <Settings />
      default:
        return <div>...</div>
    }
  }

  const renderRightSidebar = () => {
    switch (pageNavigation.rightSidebar) {
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS:
        return <AccountsRightSidebar />
      case RIGHT_SIDEBAR_ENUM.CHANNELS:
        return <ChannelsRightSidebar />
      case RIGHT_SIDEBAR_ENUM.CHANNELS_AND_ACCOUNTS:
        return <><AccountsRightSidebar /></>
      default:
        return <EmptyRightSidebar />;
    }
  }

  return (
    <>
      <CommandPalette />
      <LoginModal />
      <div className="h-full bg-gray-800 overflow-y-scroll">
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-5 xl:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-10"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-10"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-10 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-10 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-10"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-10"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  {/* Sidebar component, swap this element with another sidebar if you like */}
                  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring-1 ring-white/10">
                    <div className="flex h-16 shrink-0 items-center">
                      <img
                        className="h-8 w-auto"
                        src="./src/assets/images/herocast.png"
                        alt="herocast"
                      />
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <p
                                  onClick={() => {
                                    item.onClick();
                                    setSidebarOpen(false);
                                  }}
                                  className={classNames(
                                    item.key === mainNavigation
                                      ? 'bg-gray-800 text-white'
                                      : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold cursor-pointer'
                                  )}
                                >
                                  <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                  {item.name}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </li>
                        <li>
                          <div className="text-xs font-semibold leading-6 text-gray-400">Your channels</div>
                          <ul role="list" className="-mx-2 mt-2 space-y-1">
                            {myChannels.map((channel: ChannelType) => (
                              <li key={channel.name}>
                                <span
                                  className={classNames(
                                    false
                                      ? 'bg-gray-800 text-white'
                                      : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                    'cursor-pointer group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-[0.625rem] font-medium text-gray-400 group-hover:text-white">
                                    {channel.name}
                                  </span>
                                  {/* <span className="truncate">{team.parent_url}</span> */}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                        {/* <li className="-mx-6 mt-auto">
                          <a
                            href="#"
                            className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-white hover:bg-gray-800"
                          >
                            <img
                              className="h-8 w-8 rounded-full bg-gray-800"
                              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                              alt=""
                            />
                            <span className="sr-only">Your profile</span>
                            <span aria-hidden="true">Tom Cook</span>
                          </a>
                        </li> */}
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden xl:fixed xl:inset-y-0 xl:z-5 xl:flex xl:w-72 xl:flex-col">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 px-6 ring-1 ring-white/5">
            <div className="flex h-16 shrink-0 items-center">
              <img
                className="h-8 w-auto"
                src="./src/assets/images/herocast.png"
                alt="herocast"
              />
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <p
                          onClick={() => {
                            item.onClick();
                            setSidebarOpen(false);
                          }}
                          className={classNames(
                            item.key === mainNavigation
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold cursor-pointer'
                          )}
                        >
                          <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                          {item.name}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
                <li>
                  <div className="text-xs font-semibold leading-6 text-gray-400">Your channels</div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {myChannels.map((channel: ChannelType) => (
                      <li key={channel.name}>
                        <span
                          className={classNames(
                            false
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800',
                            'group flex gap-x-3 rounded-md p-1 text-sm leading-6 font-semibold'
                          )}
                        >
                          {/* <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-[0.625rem] font-medium text-gray-400 group-hover:text-white">
                            {channel.name}
                          </span> */}
                          <span className="font-normal truncate">{channel.name}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
                {/* <li className="-mx-6 mt-auto">
                  <a
                    href="#"
                    className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-white hover:bg-gray-800"
                  >
                    <img
                      className="h-8 w-8 rounded-full bg-gray-800"
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      alt=""
                    />
                    <span className="sr-only">Your profile</span>
                    <span aria-hidden="true">Tom Cook</span>
                  </a>
                </li> */}
              </ul>
            </nav>
          </div>
        </div>

        <div className="xl:pl-72">
          <main className="lg:pr-96">
            <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 h-20">
              <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setSidebarOpen(true)}>
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-5 w-5" aria-hidden="true" />
              </button>
              <h1 className="text-base font-semibold leading-7 text-white">{title}</h1>
            </header>
            <div className="flex items-center justify-between px-4 py-4 border-t border-white/5 sm:px-6 sm:py-6 lg:px-8">
              <Suspense fallback={<span className="font-semibold text-gray-200">Loading...</span>}>
                {renderContent()}
              </Suspense>
            </div>
          </main>
          {renderRightSidebar()}
        </div>
      </div>
    </>
  )
}
