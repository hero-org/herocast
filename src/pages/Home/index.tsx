import React, { Suspense, useEffect } from "react";
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabaseClient } from '@/common/helpers/supabase';
import {
  Cog6ToothIcon, PlusCircleIcon, SignalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Bars3Icon, UserPlusIcon } from '@heroicons/react/20/solid';
import { classNames } from "@/common/helpers/css";
import { RIGHT_SIDEBAR_ENUM } from "@/common/constants/navigation";
import AccountsRightSidebar from "@/common/components/RightSidebar/AccountsRightSidebar";
import ChannelsRightSidebar from "@/common/components/RightSidebar/ChannelsRightSidebar";
import { useAccountStore } from "@/stores/useAccountStore";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { trackPageView } from "@/common/helpers/analytics";
import EmptyRightSidebar from "@/common/components/RightSidebar/EmptyRightSidebar";
import { findParamInHashUrlPath } from "@/common/helpers/navigation";
import { BellIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import * as Toast from '@radix-ui/react-toast';
import CustomToast from "@/common/components/CustomToast";
import { useNewPostStore } from "@/stores/useNewPostStore";

type NavigationItemType = {
  name: string;
  router: string;
  icon: any;
  getTitle?: () => string;
}

export default function Home() {
  const navigate = useNavigate();
  const { pathname, hash: locationHash } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const feedTitle = useAccountStore((state) => state.channels.length > 0 && state.selectedChannelIdx !== null ? `${state.channels[state.selectedChannelIdx].name} channel` : 'Feed')

  const {
    isToastOpen,
    setIsToastOpen
  } = useNewPostStore();

  const navigation: NavigationItemType[] = [
    {
      name: 'Feed',
      router: '/feed',
      icon: SignalIcon,
      getTitle: () => feedTitle
    },
    { name: 'New Post', router: '/post', icon: PlusCircleIcon },
    { name: 'Search', router: '/search', icon: MagnifyingGlassIcon },
    { name: 'Accounts', router: '/accounts', icon: UserPlusIcon },
    // { name: 'Notifications', router: '/notifications', icon: BellIcon },
    { name: 'Settings', router: '/settings', icon: Cog6ToothIcon },
  ]

  const getSidebarForPathname = (pathname: string): RIGHT_SIDEBAR_ENUM => {
    switch (pathname) {
      case '/feed':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      case '/post':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      case '/accounts':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      case '/notifications':
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  }

  const navItem = navigation.find((item) => item.router === pathname) || { name: 'herocast', getTitle: null }
  const title = navItem.getTitle ? navItem.getTitle() : navItem.name;

  useEffect(() => {
    trackPageView(pathname.slice(1));
  }, [pathname])

  useEffect(() => {
    if (locationHash.startsWith('#error')) {
      // example location hash with error: #error=unauthorized_client&error_code=401&error_description=Email+link+is+invalid+or+has+expired
      const errorCode = findParamInHashUrlPath(locationHash, 'error_code') || '500';
      const description = findParamInHashUrlPath(locationHash, 'error_description')?.replace(/\+/g, ' ');
      console.log('throwing error', errorCode, description);
      throw new Response(description, { status: Number(errorCode), statusText: description });
    } else if (locationHash.startsWith('#access_token')) {
      console.log('locationhash', locationHash);
      navigate(`/login${locationHash}`);
    } else if (locationHash) {
      console.log('unknown locationHash', locationHash);
    } else {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        // console.log(`home getSession`, session)
        if (!session) {
          navigate('/login');
        }
      })
    }
  }, [locationHash]);

  const renderRightSidebar = () => {
    switch (getSidebarForPathname(pathname)) {
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS:
        return <AccountsRightSidebar />
      case RIGHT_SIDEBAR_ENUM.CHANNELS:
        return <ChannelsRightSidebar />
      default:
        return <EmptyRightSidebar />;
    }
  }

  return (
    <>
      <Toast.Provider swipeDirection="right">
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
                        {/* <img
                        className="h-8 w-auto"
                        src="./src/assets/images/herocast.png"
                        alt="herocast"
                      /> */}
                        <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl sm:tracking-tight">
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
                                      navigate(item.router);
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
                {/* <img
                className="h-8 w-auto"
                src="./src/assets/images/herocast.png"
                alt="herocast"
              /> */}
                <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl sm:tracking-tight">
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
                              navigate(item.router);
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
            <main className="lg:pr-80">
              <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-8 h-20">
                <button type="button" className="-m-2.5 p-2.5 text-white xl:hidden" onClick={() => setSidebarOpen(true)}>
                  <span className="sr-only">Open sidebar</span>
                  <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                </button>
                <h1 className="text-2xl font-semibold leading-7 text-white">{title}</h1>
                <h1 className="text-base font-semibold leading-7 text-white"></h1>
              </header>
              <div className="flex items-center justify-between px-4 py-4 border-t border-white/5 sm:px-6 sm:py-2 lg:px-8">
                <Suspense fallback={<span className="mt-6 font-semibold text-gray-200">Loading...</span>}>
                  <Outlet />
                </Suspense>
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
