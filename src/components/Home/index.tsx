import React, { Component, Suspense } from "react";
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ChartBarSquareIcon,
  Cog6ToothIcon, SignalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon, PlusCircleIcon, UserPlusIcon } from '@heroicons/react/20/solid';
import FarcasterLogin from "@src/components/FarcasterLogin";
import { ACCOUNTS_ATOM_KEY, MAIN_NAVIGATION_ATOM_KEY, MAIN_NAVIGATION_ENUM, atomWithLocalStorage, mainNavigationAtom } from "@src/state";
import { atom, useAtom, useSetAtom } from "jotai";
import { classNames } from "@src/utils";

const Feed = React.lazy(() =>
  import('@src/components/Feed'),
);
const NewPost = React.lazy(() =>
  import('@src/components/NewPost'),
);
const Replies = React.lazy(() =>
  import('@src/components/Replies'),
);
const Settings = React.lazy(() =>
  import('@src/components/Settings'),
);


const channels = [
  { id: 1, name: '/dev', href: '#', initial: 'dev', current: false },
  { id: 2, name: 'OP Stack', href: '#', initial: 'OP', current: false },
  { id: 3, name: 'memes', href: '#', initial: 'M', current: false },
]


const accountsAtom = atomWithLocalStorage(ACCOUNTS_ATOM_KEY, {})
const accountKeysAtom = atom((get) => Object.values(get(accountsAtom)))


export default function Home({ mainNavigation }: { mainNavigation: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accounts] = useAtom(accountKeysAtom)
  const setMainNavigation = useSetAtom(mainNavigationAtom)

  const navigation = [
    { name: 'Feed', icon: SignalIcon, key: MAIN_NAVIGATION_ENUM.FEED },
    { name: 'Replies', icon: ChartBarSquareIcon, key: MAIN_NAVIGATION_ENUM.REPLIES },
    { name: 'New Post', icon: PlusCircleIcon, key: MAIN_NAVIGATION_ENUM.NEW_POST },
    { name: 'Add Account', icon: UserPlusIcon, key: MAIN_NAVIGATION_ENUM.ADD_ACCOUNT },
    { name: 'Settings', icon: Cog6ToothIcon, key: MAIN_NAVIGATION_ENUM.SETTINGS },
  ]
  const title = navigation.find((item) => item.key === mainNavigation)?.name

  console.log(`Home mainNavigation via props: ${mainNavigation}`)

  const renderContent = () => {
    switch (mainNavigation) {
      case MAIN_NAVIGATION_ENUM.FEED:
        return <Feed />
      case MAIN_NAVIGATION_ENUM.REPLIES:
        return <Replies />
      case MAIN_NAVIGATION_ENUM.NEW_POST:
        return <NewPost />
      case MAIN_NAVIGATION_ENUM.ADD_ACCOUNT:
        return <FarcasterLogin />
      case MAIN_NAVIGATION_ENUM.SETTINGS:
        return <Settings />
      default:
        return <div>...</div>
    }
  }

  const renderRightSidebar = () => {
    return <aside className="bg-black/10 lg:fixed lg:bottom-0 lg:right-0 lg:top-20 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-white/5">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <h2 className="text-base font-semibold leading-7 text-white">Accounts</h2>
        <a href="#" className="text-sm font-semibold leading-6 text-indigo-400">
          View all
        </a>
      </header>
      <ul role="list" className="divide-y divide-white/5">
        {accounts.map((item) => (
          <li key={item.publicKey} className="px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-x-3">
              {/* <img src={item.user.imageUrl} alt="" className="h-6 w-6 flex-none rounded-full bg-gray-800" /> */}
              <h3 className="flex-auto truncate text-sm font-semibold leading-6 text-white">{item.username}</h3>
              {/* <span dateTime={item.timestamp} className="flex-none text-xs text-gray-600">
                {item.timestamp}
              </span> */}
            </div>
            <p className="mt-2 truncate text-sm text-gray-500">
              login on <span className="text-gray-400">{item.timestampString}</span>{' '}
              fid <span className="text-gray-400">{item.fid}</span>
            </p>
          </li>
        ))}
      </ul>
    </aside>
  }

  return (
    <>
      <div className="h-full bg-gray-900">
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 xl:hidden" onClose={setSidebarOpen}>
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
                        src="https://tailwindui.com/img/logos/mark.svg?color=white"
                        alt="Your Company"
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
                                    setMainNavigation(item.key);
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
                            {channels.map((team) => (
                              <li key={team.name}>
                                <a
                                  href={team.href}
                                  className={classNames(
                                    team.current
                                      ? 'bg-gray-800 text-white'
                                      : 'text-gray-400 hover:text-white hover:bg-gray-800',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-[0.625rem] font-medium text-gray-400 group-hover:text-white">
                                    {team.initial}
                                  </span>
                                  <span className="truncate">{team.name}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </li>
                        <li className="-mx-6 mt-auto">
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
                        </li>
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden xl:fixed xl:inset-y-0 xl:z-50 xl:flex xl:w-72 xl:flex-col">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 px-6 ring-1 ring-white/5">
            <div className="flex h-16 shrink-0 items-center">
              <img
                className="h-8 w-auto"
                src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
                alt="Your Company"
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
                            setMainNavigation(item.key);
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
                    {channels.map((team) => (
                      <li key={team.name}>
                        <a
                          href={team.href}
                          className={classNames(
                            team.current
                              ? 'bg-gray-800 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-[0.625rem] font-medium text-gray-400 group-hover:text-white">
                            {team.initial}
                          </span>
                          <span className="truncate">{team.name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="-mx-6 mt-auto">
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
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="xl:pl-72">
          <main className="lg:pr-96">
            <header className="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 h-20">
              <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setSidebarOpen(true)}>
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-5 w-5" aria-hidden="true" />
              </button>
              <h1 className="text-base font-semibold leading-7 text-white">{title}</h1>
            </header>
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
              <Suspense fallback={<div>Loading...</div>}>
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
