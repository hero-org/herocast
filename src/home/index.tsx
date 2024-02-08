import React, { useEffect } from "react";
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabaseClient } from '../common/helpers/supabase';
import {
  Cog6ToothIcon, PlusCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon, UserPlusIcon } from '@heroicons/react/20/solid';
import { classNames } from "../common/helpers/css";
import { RIGHT_SIDEBAR_ENUM } from "../common/constants/navigation";
import AccountsRightSidebar from "../common/components/RightSidebar/AccountsRightSidebar";
import ChannelsRightSidebar from "../common/components/RightSidebar/ChannelsRightSidebar";
import { AccountObjectType, useAccountStore } from "../stores/useAccountStore";
import { trackPageView } from "../common/helpers/analytics";
import { findParamInHashUrlPath } from "../common/helpers/navigation";
import { BellIcon, MagnifyingGlassIcon, NewspaperIcon, RectangleGroupIcon } from "@heroicons/react/24/solid";
import * as Toast from '@radix-ui/react-toast';
import CustomToast from "../common/components/CustomToast";
import { useNewPostStore } from "../stores/useNewPostStore";
import { SidebarHeader } from "../common/components/RightSidebar/SidebarHeader";
import { useRouter } from "next/router";

type NavigationItemType = {
  name: string;
  router: string;
  icon: any;
  getTitle?: () => string;
}

const Home = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { pathname, asPath } = router;
  const locationHash = asPath.split('#')[1];
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const {
    accounts,
    allChannels,
    selectedAccountIdx,
    selectedChannelUrl,
    setCurrentAccountIdx
  } = useAccountStore();

  const selectedChannelIdx = allChannels?.findIndex((channel) => channel.url === selectedChannelUrl);
  const feedTitle = selectedChannelIdx !== -1 ? `${allChannels[selectedChannelIdx]?.name} channel` : 'Feed';

  const {
    isToastOpen,
    setIsToastOpen
  } = useNewPostStore();

  const navigation: NavigationItemType[] = [
    {
      name: 'Feed',
      router: '/feed',
      icon: NewspaperIcon,
      getTitle: () => feedTitle
    },
    { name: 'New Post', router: '/post', icon: PlusCircleIcon },
    { name: 'Search', router: '/search', icon: MagnifyingGlassIcon },
    { name: 'Channels', router: '/channels', icon: RectangleGroupIcon },
    { name: 'Accounts', router: '/accounts', icon: UserPlusIcon },
    {
      name: 'Notifications', router: '/notifications', icon: BellIcon, getTitle: () => 'Your notifications'
    },
    { name: 'Settings', router: '/settings', icon: Cog6ToothIcon },
  ]

  const getSidebarForPathname = (pathname: string): RIGHT_SIDEBAR_ENUM => {
    switch (pathname) {
      case '/feed':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case '/post':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case '/channels':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case '/accounts':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      case '/notifications':
        return RIGHT_SIDEBAR_ENUM.NONE;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  }

  const navItem = navigation.find((item) => item.router === pathname) || { name: '', getTitle: null }
  const title = navItem.getTitle ? navItem.getTitle() : navItem.name;

  // useEffect(() => {
  //   trackPageView(pathname.slice(1));
  // }, [pathname])

  useEffect(() => {
    if (locationHash && locationHash.startsWith('#error')) {
      // example location hash with error: #error=unauthorized_client&error_code=401&error_description=Email+link+is+invalid+or+has+expired
      const errorCode = findParamInHashUrlPath(locationHash, 'error_code') || '500';
      const description = findParamInHashUrlPath(locationHash, 'error_description')?.replace(/\+/g, ' ');
      console.log('throwing error', errorCode, description);
      throw new Response(description, { status: Number(errorCode), statusText: description });
    } else if (locationHash && locationHash.startsWith('#access_token')) {
      console.log('locationhash', locationHash);
      router.push(`/login${locationHash}`);
    } else if (locationHash) {
      console.log('unknown locationHash', locationHash);
    } else {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session && pathname !== '/login' && !pathname.startsWith('/profile')) {
          router.push('/login');
        }
      })
    }
  }, [locationHash]);

  const sidebarType = getSidebarForPathname(pathname);

  const renderRightSidebar = () => {
    switch (sidebarType) {
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS:
        return <AccountsRightSidebar showChannels />
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS:
        return <AccountsRightSidebar />
      case RIGHT_SIDEBAR_ENUM.CHANNELS:
        return <ChannelsRightSidebar />
      case RIGHT_SIDEBAR_ENUM.NONE:
        return null;
      default:
        return <aside className="bg-gray-800 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-24">
          <header className="flex border-t border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          </header>
        </aside>;
    }
  }

  const renderAccountSidebar = () => (
    <div className="flex flex-col">
      <SidebarHeader title="Accounts" />
      <ul role="list" className="mx-4 divide-y divide-white/5">
        {accounts.map((item: AccountObjectType, idx: number) => (
          <li key={item.id} className="px-2 py-2 sm:px-3 lg:px-4">
            <div
              onClick={() => item.status === "active" && setCurrentAccountIdx(idx)}
              className="flex items-center gap-x-3 cursor-pointer"
            >
              <h3 className={classNames(
                idx === selectedAccountIdx ? "text-gray-100" : "text-gray-400",
                "flex-auto truncate text-sm font-semibold leading-6")}>{item.name}</h3>
              {item.status !== "active" && (
                <span className={classNames("underline flex-none text-sm text-gray-400")}>
                  {item.status}
                </span>)}
              {item.platformAccountId && (
                <p className="mt-1 text-sm text-gray-500">
                  fid {item.platformAccountId}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

  if (pathname === '/login') {
    return children;
  }

  return (
    <>
      <Toast.Provider swipeDirection="right">
        <div className="h-full bg-gray-800">
          <Transition.Root show={sidebarOpen} as={Fragment}>
            <Dialog as="div" className="relative z-5 lg:hidden" onClose={setSidebarOpen}>
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
                  <Dialog.Panel className="relative mr-10 flex w-full max-w-xs flex-1">
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
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 ring-1 ring-gray-700/10">
                      <div className="flex h-16 shrink-0 items-center">
                        {/* <img
                        className="h-8 w-auto"
                        src="./src/assets/images/herocast.png"
                        alt="herocast"
                      /> */}
                        <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:tracking-tight">
                          herocast
                        </h2>
                      </div>
                      <nav className="flex flex-1 flex-col">
                        <ul role="list" className="flex flex-1 flex-col gap-y-7">
                          <li>
                            <ul role="list" className="-mx-2 space-y-1">
                              {navigation.map((item) => (
                                <li key={item.name}>
                                  <p
                                    onClick={() => {
                                      if (pathname === '/login') return;
                                      router.push(item.router);
                                      setSidebarOpen(false);
                                    }}
                                    className={classNames(
                                      item.router === pathname
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
                          {renderAccountSidebar()}
                        </ul>
                      </nav>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </Dialog>
          </Transition.Root>

          {/* Static sidebar for desktop */}
          <div className="hidden lg:fixed lg:inset-y-0 lg:z-5 lg:flex lg:w-48 lg:flex-col">
            {/* Sidebar component, swap this element with another sidebar if you like */}
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-black/10 px-6 ring-1 ring-white/5">
              <div className="flex h-16 shrink-0 items-center">
                <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:tracking-tight">
                  herocast
                </h2>
              </div>
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                  <li>
                    <ul role="list" className="-mx-2 space-y-1">
                      {navigation.map((item) => (
                        <li key={item.name}>
                          <p
                            onClick={() => {
                              if (pathname === '/login') return;
                              router.push(item.router);
                              setSidebarOpen(false);
                            }}
                            className={classNames(
                              item.router === pathname
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
                </ul>
              </nav>
            </div>
          </div>
          <div className="lg:pl-48">
            <main className={classNames(sidebarType === RIGHT_SIDEBAR_ENUM.NONE ? "" : "lg:pr-64")}>
              <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-6 h-16">
                <button type="button" className="-m-2.5 p-2.5 text-white lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <span className="sr-only">Open sidebar</span>
                  <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                </button>
                <h1 className="mx-auto text-2xl font-semibold leading-7 text-white">{title}</h1>
              </header>
              <div className="w-full max-w-full min-h-screen flex justify-between px-2 border-t border-white/5 ">
                {children}
              </div>
            </main>
            {renderRightSidebar()}
          </div>
        </div>
        <CustomToast
          title="Cast published successfully"
          showToast={isToastOpen}
          setShowToast={(showToast) => setIsToastOpen(showToast)}
        />
        <Toast.Viewport className="[--viewport-padding:_25px] fixed bottom-0 right-0 flex flex-col p-[var(--viewport-padding)] gap-[5px] w-[320px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none" />
      </Toast.Provider>
    </>
  )
}

export default Home;