import React from "react";
import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  Cog6ToothIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Bars3Icon, UserPlusIcon } from "@heroicons/react/20/solid";
import { classNames } from "@/common/helpers/css";
import { RIGHT_SIDEBAR_ENUM } from "../common/constants/navigation";
import RightSidebar from "@/common/components/Sidebar/RightSidebar";
import ChannelsRightSidebar from "@/common/components/Sidebar/ChannelsRightSidebar";
import { CUSTOM_CHANNELS, useAccountStore } from "@/stores/useAccountStore";
import {
  BellIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  RectangleGroupIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import { ThemeToggle } from "@/common/components/ThemeToggle";
import herocastImg from "../../public/images/logo.png";
import { Toaster } from "@/components/ui/sonner";
import AccountSwitcher from "@/common/components/Sidebar/AccountSwitcher";
import { cn } from "@/lib/utils";
import { Loading } from "@/common/components/Loading";
import useInitializeStores from "@/common/hooks/useInitializeStores";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountPlatformType } from "@/common/constants/accounts";

type NavigationItemType = {
  name: string;
  router: string;
  icon: any;
  getTitle?: () => string | JSX.Element;
  shortcut?: string;
  additionalPaths?: string[];
};

const Home = ({ children }: { children: React.ReactNode }) => {
  useInitializeStores();

  const router = useRouter();

  const { pathname } = router;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { allChannels, selectedChannelUrl, isHydrated } = useAccountStore();
  const isReadOnlyUser = useAccountStore(
    (state) =>
      state.accounts.length === 1 &&
      state.accounts[0].platform ===
        AccountPlatformType.farcaster_local_readonly
  );

  const getFeedTitle = () => {
    if (selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING.toString()) {
      return "Following Feed";
    }
    if (selectedChannelUrl === CUSTOM_CHANNELS.TRENDING.toString()) {
      return "Trending Feed";
    }

    const selectedChannelIdx = allChannels?.findIndex(
      (channel) => channel.url === selectedChannelUrl
    );
    if (selectedChannelIdx !== -1) {
      const channel = allChannels[selectedChannelIdx];
      return (
        <div className="flex max-w-sm items-center">
          {channel.icon_url && (
            <img
              src={channel.icon_url}
              alt=""
              className={cn(
                "mr-1 bg-gray-100 border h-5 w-5 flex-none rounded-full"
              )}
            />
          )}
          <span className="flex-nowrap truncate">{channel.name} channel</span>
        </div>
      );
    }
    return "Feed";
  };

  const navigation: NavigationItemType[] = [
    {
      name: "Feeds",
      router: "/feeds",
      icon: <NewspaperIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
      getTitle: getFeedTitle,
      shortcut: "Shift + F",
    },
    {
      name: "Post",
      router: "/post",
      icon: <PlusCircleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
    },
    {
      name: "Search",
      router: "/search",
      icon: (
        <MagnifyingGlassIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
      ),
      shortcut: "/",
    },
    {
      name: "Channels",
      router: "/channels",
      icon: (
        <RectangleGroupIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
      ),
      shortcut: "Shift + C",
    },
    {
      name: "Notifications",
      router: "/notifications",
      icon: <BellIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
      getTitle: () => "Notifications",
      shortcut: "Shift + N",
    },
    {
      name: "Accounts",
      router: "/accounts",
      icon: <UserPlusIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
      shortcut: "CMD + Shift + A",
      additionalPaths: ["/farcaster-signup", "/hats"],
    },
    {
      name: "Settings",
      router: "/settings",
      icon: <Cog6ToothIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
      shortcut: "Shift + ,",
    },
  ];

  const getSidebarForPathname = (pathname: string): RIGHT_SIDEBAR_ENUM => {
    switch (pathname) {
      case "/feeds":
        return RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR;
      case "/post":
        return RIGHT_SIDEBAR_ENUM.NONE;
      case "/channels":
        return RIGHT_SIDEBAR_ENUM.NONE;
      case "/notifications":
        return RIGHT_SIDEBAR_ENUM.CAST_INFO;
      case "/search":
        return RIGHT_SIDEBAR_ENUM.SEARCH;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  };

  const onClickItem = (item: NavigationItemType) => {
    if (pathname === "/login") return;
    setSidebarOpen(false);
    router.push(item.router);
  };

  const navItem = navigation.find((item) => item.router === pathname) || {
    name: "",
    getTitle: null,
  };

  const title = navItem.getTitle ? navItem.getTitle() : navItem.name;
  const sidebarType = getSidebarForPathname(pathname);

  const renderRightSidebar = () => {
    switch (sidebarType) {
      case RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR:
        return <RightSidebar showChannels showAuthorInfo />;
      case RIGHT_SIDEBAR_ENUM.CAST_INFO:
        return <RightSidebar showAuthorInfo />;
      case RIGHT_SIDEBAR_ENUM.CHANNELS:
        return <ChannelsRightSidebar />;
      case RIGHT_SIDEBAR_ENUM.SEARCH:
        return <RightSidebar showLists showSearches showAuthorInfo />;
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

  const renderUpgradeCard = () => (
    <Card>
      <CardHeader className="p-2 pt-0 md:p-4">
        <CardTitle>Upgrade to full account</CardTitle>
        <CardDescription>
          Unlock all features and start casting with herocast.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
        <Button
          size="sm"
          className="w-full"
          onClick={() => router.push("/login?signupOnly=true")}
        >
          Upgrade
        </Button>
      </CardContent>
    </Card>
  );

  if (pathname === "/login") {
    return children;
  }

  return (
    <div className="h-full bg-background">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-5 lg:hidden"
          onClose={() => setSidebarOpen(false)}
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
              <Dialog.Panel className="relative mr-2 flex w-full max-w-64 flex-1">
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
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <p
                                onClick={() => onClickItem(item)}
                                className={classNames(
                                  item.router === pathname ||
                                    item.additionalPaths?.includes(pathname)
                                    ? "text-foreground bg-foreground/10"
                                    : "text-foreground/70 hover:text-foreground hover:bg-foreground/30",
                                  "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold cursor-pointer"
                                )}
                              >
                                {item.icon}
                                {item.name}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <ThemeToggle />
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
      <div className="hidden lg:flex lg:grow lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-52 lg:overflow-y-auto lg:bg-background border-r border-muted">
        {/* Sidebar component, swap this element with another sidebar if you like */}
        <div className="flex grow flex-col flex-1 gap-y-5 overflow-y-auto bg-background px-6">
          <div className="flex h-16 shrink-0 items-center">
            <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:tracking-tight">
              herocast
            </h2>
          </div>
          <div className="flex flex-col justify-between">
            <nav className="mt-0">
              <ul role="list" className="flex flex-col items-left space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <div
                      onClick={() => onClickItem(item)}
                      className={classNames(
                        item.router === pathname ||
                          item.additionalPaths?.includes(pathname)
                          ? "text-background bg-foreground dark:text-foreground/60 dark:bg-foreground/10 dark:hover:text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        "group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold cursor-pointer"
                      )}
                    >
                      {item.icon}
                      <span className="">{item.name}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          {isReadOnlyUser && renderUpgradeCard()}
          <div className="mt-auto flex flex-row space-x-2 py-4">
            <AccountSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div
        className={cn(
          sidebarType !== RIGHT_SIDEBAR_ENUM.NONE && "md:pr-48 lg:pr-64",
          "xl:pl-52"
        )}
      >
        {/* Sticky search header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-6 border-b border-white/5 bg-background px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-white xl:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="ml-4 mx-auto text-xl font-bold leading-7 text-foreground">
            {title}
          </h1>
        </div>
        <main>
          {!isHydrated && (
            <Loading className="ml-8" loadingMessage="Loading herocast" />
          )}
          <div className="w-full max-w-full min-h-screen flex justify-between">
            {children}
          </div>
          {renderRightSidebar()}
        </main>
      </div>
      <Toaster theme="system" position="bottom-right" />
    </div>
  );
};

export default Home;
