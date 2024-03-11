import React, { useEffect } from "react";
import { Fragment, useState } from "react";
import { Dialog, Menu, Transition } from "@headlessui/react";
import { supabaseClient } from "../common/helpers/supabase";
import {
  Cog6ToothIcon,
  PlusCircleIcon,
  XMarkIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import {
  Bars3Icon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { classNames } from "../common/helpers/css";
import { RIGHT_SIDEBAR_ENUM } from "../common/constants/navigation";
import AccountsRightSidebar from "../common/components/RightSidebar/AccountsRightSidebar";
import ChannelsRightSidebar from "../common/components/RightSidebar/ChannelsRightSidebar";
import { CUSTOM_CHANNELS, useAccountStore } from "../stores/useAccountStore";
import { findParamInHashUrlPath } from "../common/helpers/navigation";
import {
  BellIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/solid";
import * as Toast from "@radix-ui/react-toast";
import CustomToast from "../common/components/CustomToast";
import { useNewPostStore } from "../stores/useNewPostStore";
import { useRouter } from "next/router";
import { ThemeToggle } from "@/common/components/ThemeToggle";
import herocastImg from "../../public/images/logo.png";
import { trackPageView } from "@/common/helpers/analytics";

type NavigationItemType = {
  name: string;
  router: string;
  icon: any;
  getTitle?: () => string;
};

const Home = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { pathname, asPath } = router;
  const locationHash = asPath.split("#")[1];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { allChannels, selectedChannelUrl } = useAccountStore();

  const getFeedTitle = () => {
    if (selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING) {
      return "Following Feed";
    }
    if (selectedChannelUrl === CUSTOM_CHANNELS.TRENDING) {
      return "Trending Feed";
    }

    const selectedChannelIdx = allChannels?.findIndex(
      (channel) => channel.url === selectedChannelUrl
    );
    if (selectedChannelIdx !== -1) {
      return `${allChannels[selectedChannelIdx]?.name} channel`;
    }
    return "Feed";
  };

  const { isToastOpen, setIsToastOpen } = useNewPostStore();

  const navigation: NavigationItemType[] = [
    {
      name: "Feed",
      router: "/feed",
      icon: NewspaperIcon,
      getTitle: getFeedTitle,
    },
    { name: "New Post", router: "/post", icon: PlusCircleIcon },
    { name: "Search", router: "/search", icon: MagnifyingGlassIcon },
    { name: "Channels", router: "/channels", icon: RectangleGroupIcon },
    { name: "Accounts", router: "/accounts", icon: UserPlusIcon },
    {
      name: "Notifications",
      router: "/notifications",
      icon: BellIcon,
      getTitle: () => "Your notifications",
    },
    {
      name: "Hats Protocol",
      router: "/hats",
      icon: AcademicCapIcon,
    },
    { name: "Settings", router: "/settings", icon: Cog6ToothIcon },
  ];

  const getSidebarForPathname = (pathname: string): RIGHT_SIDEBAR_ENUM => {
    switch (pathname) {
      case "/feed":
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case "/post":
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case "/channels":
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS;
      case "/accounts":
        return RIGHT_SIDEBAR_ENUM.ACCOUNTS;
      case "/notifications":
        return RIGHT_SIDEBAR_ENUM.NONE;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  };

  const navItem = navigation.find((item) => item.router === pathname) || {
    name: "",
    getTitle: null,
  };
  const title = navItem.getTitle ? navItem.getTitle() : navItem.name;

  useEffect(() => {
    trackPageView(pathname.slice(1));
  }, [pathname]);

  useEffect(() => {
    if (locationHash && locationHash.startsWith("#error")) {
      // example location hash with error: #error=unauthorized_client&error_code=401&error_description=Email+link+is+invalid+or+has+expired
      const errorCode =
        findParamInHashUrlPath(locationHash, "error_code") || "500";
      const description = findParamInHashUrlPath(
        locationHash,
        "error_description"
      )?.replace(/\+/g, " ");
      console.log("throwing error", errorCode, description);
      throw new Response(description, {
        status: Number(errorCode),
        statusText: description,
      });
    } else if (locationHash && locationHash.startsWith("#access_token")) {
      console.log("locationhash", locationHash);
      router.push(`/login${locationHash}`);
    } else if (locationHash) {
      console.log("unknown locationHash", locationHash);
    } else {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session && pathname !== "/login") {
          router.push("/login");
        }
      });
    }
  }, [locationHash]);

  const sidebarType = getSidebarForPathname(pathname);

  const renderRightSidebar = () => {
    switch (sidebarType) {
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS_AND_CHANNELS:
        return <AccountsRightSidebar showChannels />;
      case RIGHT_SIDEBAR_ENUM.ACCOUNTS:
        return <AccountsRightSidebar />;
      case RIGHT_SIDEBAR_ENUM.CHANNELS:
        return <ChannelsRightSidebar />;
      case RIGHT_SIDEBAR_ENUM.NONE:
        return null;
      default:
        return (
          <aside className="bg-background lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-24">
            <header className="flex border-t border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8"></header>
          </aside>
        );
    }
  };

  const renderAccountSidebar = () => <AccountsRightSidebar />;

  if (pathname === "/login") {
    return children;
  }

  return (
    <>
      <Toast.Provider swipeDirection="right">
        <div className="h-full bg-background">
          <Transition.Root show={sidebarOpen} as={Fragment}>
            <Dialog
              as="div"
              className="relative z-5 lg:hidden"
              onClose={setSidebarOpen}
            >
              <Transition.Child
                as={Fragment}
                enter="transition-opacity ease-linear duration-10"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity ease-linear duration-10"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-background/80" />
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
                        <button
                          type="button"
                          className="-m-2.5 p-2.5"
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="sr-only">Close sidebar</span>
                          <XMarkIcon
                            className="h-6 w-6 text-foreground"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </Transition.Child>
                    {/* Sidebar component, swap this element with another sidebar if you like */}
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 ring-1 ring-gray-700/10">
                      <div className="flex h-16 shrink-0 items-center">
                        <img
                          className="h-8 w-auto"
                          src={herocastImg.src}
                          alt="herocast"
                        />
                        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:tracking-tight">
                          herocast
                        </h2>
                      </div>
                      <nav className="flex flex-1 flex-col">
                        <ul
                          role="list"
                          className="flex flex-1 flex-col gap-y-7"
                        >
                          <li>
                            <ul role="list" className="-mx-2 space-y-1">
                              {navigation.map((item) => (
                                <li key={item.name}>
                                  <p
                                    onClick={() => {
                                      if (pathname === "/login") return;
                                      router.push(item.router);
                                      setSidebarOpen(false);
                                    }}
                                    className={classNames(
                                      item.router === pathname
                                        ? "text-foreground bg-foreground/10"
                                        : "text-foreground/70 hover:text-foreground hover:bg-foreground/30",
                                      "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold cursor-pointer"
                                    )}
                                  >
                                    <item.icon
                                      className="h-6 w-6 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {item.name}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </li>
                          <ThemeToggle />
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
          {/* <div className="hidden lg:fixed lg:inset-y-0 lg:z-5 lg:flex lg:w-48 lg:flex-col"> */}
          <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-20 lg:overflow-y-auto lg:bg-background border-r border-muted">
            {/* Sidebar component, swap this element with another sidebar if you like */}
            <div className="flex grow flex-col min-h-full gap-y-5 overflow-y-auto bg-background px-6 ring-1 ring-white/5">
              <div className="flex h-16 shrink-0 items-center">
                <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:tracking-tight">
                  herocast
                </h2>
                <img
                  className="h-8 w-auto"
                  src={herocastImg.src}
                  alt="herocast"
                />
              </div>
              <div className="h-full min-h-full flex flex-col justify-between">
                <nav className="mt-0">
                  <ul
                    role="list"
                    className="flex flex-col items-center space-y-1"
                  >
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <a
                          onClick={() => {
                            if (pathname === "/login") return;
                            router.push(item.router);
                            setSidebarOpen(false);
                          }}
                          className={classNames(
                            item.router === pathname
                              ? "text-background bg-foreground dark:text-foreground/60 dark:bg-foreground/10 dark:hover:text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                            "group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold cursor-pointer"
                          )}
                        >
                          <item.icon
                            className="h-6 w-6 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="sr-only">{item.name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="lg:pl-20">
            <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-0 border-muted bg-background px-4 sm:gap-x-6 sm:px-6 lg:px-8">
              <button
                type="button"
                className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
              </button>
              <h1 className="mx-auto text-xl font-semibold leading-7 text-foreground">
                {title}
              </h1>
              {/* Separator */}
              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                  {/* Separator */}
                  {/* <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" aria-hidden="true" /> */}
                  {/* Profile dropdown */}
                  {/* <Menu as="div" className="relative">
                  <Menu.Button className="-m-1.5 flex items-center p-1.5">
                    <span className="sr-only">Open user menu</span>
                    <img
                      className="h-8 w-8 rounded-full bg-gray-50"
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      alt=""
                    />
                    <span className="hidden lg:flex lg:items-center">
                      <span className="ml-4 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">
                        Tom Cook
                      </span>
                      <ChevronDownIcon className="ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                    </Menu.Items>
                  </Transition>
                </Menu> */}
                </div>
              </div>
            </div>
            <main
              className={classNames(
                sidebarType === RIGHT_SIDEBAR_ENUM.NONE
                  ? ""
                  : "md:pr-48 lg:pr-64"
              )}
            >
              <div className="w-full max-w-full min-h-screen flex justify-between">
                {children}
              </div>
              {renderRightSidebar()}
            </main>
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
  );
};

export default Home;
