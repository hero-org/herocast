import React, { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpCircleIcon, Cog6ToothIcon, PencilSquareIcon, UserIcon } from '@heroicons/react/20/solid';
import {
  Bars3Icon,
  UserPlusIcon,
  BellIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  RectangleGroupIcon,
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { RIGHT_SIDEBAR_ENUM } from '../common/constants/navigation';
import RightSidebar from '@/common/components/Sidebar/RightSidebar';
import { CUSTOM_CHANNELS, useAccountStore } from '@/stores/useAccountStore';
import { ThemeToggle } from '@/common/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import AccountSwitcher from '@/common/components/Sidebar/AccountSwitcher';
import { cn } from '@/lib/utils';
import { Loading } from '@/common/components/Loading';
import useInitializeStores from '@/common/hooks/useInitializeStores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccountPlatformType } from '@/common/constants/accounts';
import NewCastModal from '@/common/components/NewCastModal';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { useDraftStore } from '@/stores/useDraftStore';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/20/solid';
import PublishedCastsRightSidebar from '@/common/components/Sidebar/PublishedCastsRightSidebar';
import { useListStore } from '@/stores/useListStore';
import { LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY } from '@/common/constants/localStorage';

type NavigationGroupType = {
  name: string;
  items: NavigationItemType[];
};

type NavigationItemType = {
  name: string;
  router: string;
  icon?: any;
  getTitle?: () => string | JSX.Element;
  getHeaderActions?: () => HeaderAction[];
  shortcut?: string;
  additionalPaths?: string[];
  hide?: boolean;
};

type HeaderAction = {
  name: string | JSX.Element;
  onClick: () => void;
};

const Home = ({ children }: { children: React.ReactNode }) => {
  useInitializeStores();

  const router = useRouter();

  const { asPath, pathname } = router;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { allChannels, selectedChannelUrl, isHydrated, addPinnedChannel, removePinnedChannel } = useAccountStore();
  const {
    castModalDraftId,
    isNewCastModalOpen,
    openNewCastModal,
    closeNewCastModal,
    setCastModalView,
    setCastModalDraftId,
  } = useNavigationStore();
  const selectedList = useListStore((state) => state.lists.find((l) => l.id === state.selectedListId));
  const { addNewPostDraft } = useDraftStore();
  const channels = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels || []);
  const pageRequiresHydrate =
    asPath !== '/login' &&
    !asPath.startsWith('/profile') &&
    !asPath.startsWith('/conversation') &&
    !asPath.startsWith('/analytics');

  const isReadOnlyUser = useAccountStore(
    (state) =>
      state.accounts.length === 1 && state.accounts[0].platform === AccountPlatformType.farcaster_local_readonly
  );
  const [hasFinishedOnboarding, setHasFinishedOnboarding] = useState(false);
  const loadingMessages = [
    'Preparing your Farcaster experience',
    'Loading herocast',
    "You haven't been here for a while, welcome back!",
  ];
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!isHydrated) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
      }, 3000); // Change message every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isHydrated]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY) {
        setHasFinishedOnboarding(event.newValue === 'true');
      }
    };

    const checkOnboardingStatus = () => {
      if (typeof window !== 'undefined' && localStorage) {
        setHasFinishedOnboarding(localStorage.getItem(LOCAL_STORAGE_ONBOARDING_COMPLETED_KEY) === 'true');
      }
    };

    checkOnboardingStatus();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, []);

  const getFeedTitle = () => {
    if (selectedList) {
      return selectedList.name;
    }
    if (selectedChannelUrl === CUSTOM_CHANNELS.FOLLOWING.toString()) {
      return 'Following Feed';
    }
    if (selectedChannelUrl === CUSTOM_CHANNELS.TRENDING.toString()) {
      return 'Trending Feed';
    }

    const selectedChannelIdx = allChannels?.findIndex((channel) => channel.url === selectedChannelUrl);
    if (selectedChannelIdx !== -1) {
      const channel = allChannels[selectedChannelIdx];
      return (
        <div className="flex max-w-sm items-center">
          {channel.icon_url && (
            <Image
              src={channel.icon_url}
              alt={`${channel.name} icon`}
              width={20}
              height={20}
              className={cn('mr-1 bg-gray-100 border flex-none rounded-full')}
            />
          )}
          <span className="max-w-xs flex truncate">{channel.name} channel</span>
        </div>
      );
    }
    return 'Feed';
  };

  const navigationGroups: NavigationGroupType[] = [
    {
      name: 'main',
      items: [
        {
          name: 'Feeds',
          router: '/feeds',
          icon: <NewspaperIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          getTitle: getFeedTitle,
          getHeaderActions: () => {
            const isChannelPinned = channels.findIndex((channel) => channel.url === selectedChannelUrl) !== -1;
            const isChannelFeed =
              selectedChannelUrl !== CUSTOM_CHANNELS.FOLLOWING &&
              selectedChannelUrl !== CUSTOM_CHANNELS.TRENDING &&
              !selectedList;
            const actions = [
              {
                name: 'Cast',
                onClick: () => {
                  let parentUrl;
                  if (isChannelFeed) {
                    parentUrl = selectedChannelUrl;
                  }
                  setCastModalView(CastModalView.New);
                  addNewPostDraft({
                    parentUrl,
                    onSuccess(draftId) {
                      setCastModalDraftId(draftId);
                      openNewCastModal();
                    },
                  });
                },
              },
            ];
            if (isChannelFeed) {
              actions.push({
                name: isChannelPinned ? 'Unpin' : 'Pin',
                onClick: () => {
                  const channel = channels.find((c) => c.url === selectedChannelUrl);
                  if (!channel) return;

                  if (isChannelPinned) {
                    removePinnedChannel(channel);
                  } else {
                    addPinnedChannel(channel);
                  }
                },
              });
            }
            return actions;
          },
          shortcut: 'Shift + F',
          additionalPaths: ['/conversation/[...slug]'],
        },
        {
          name: 'Post',
          router: '/post',
          getHeaderActions: () => [
            {
              name: (
                <>
                  {' '}
                  <PencilSquareIcon className="w-5 h-5 mr-2" />
                  New draft
                </>
              ),
              onClick: () => addNewPostDraft({ force: true }),
            },
          ],
          icon: <PencilSquareIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
        },
        {
          name: 'Search',
          router: '/search',
          icon: <MagnifyingGlassIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: '/',
        },
        // {
        //   name: 'Notifications',
        //   router: '/notifications',
        //   icon: <BellIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
        //   shortcut: 'Shift + N',
        // },
        // {
        //   name: 'Analytics',
        //   router: '/analytics',
        //   icon: <ChartBarIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
        //   shortcut: 'Shift + A',
        // },
        {
          name: 'Profile',
          router: '/profile',
          icon: <UserIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          additionalPaths: ['/profile', '/profile/[slug]'],
        },
      ],
    },
    {
      name: 'settings',
      items: [
        {
          name: 'Upgrade',
          router: '/upgrade',
          icon: <ArrowUpCircleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
        },
        // {
        //   name: 'Channels',
        //   router: '/channels',
        //   icon: <RectangleGroupIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
        //   shortcut: 'Shift + C',
        // },
        {
          name: 'Accounts',
          router: '/accounts',
          icon: <UserPlusIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: 'CMD + Shift + A',
          additionalPaths: ['/farcaster-signup', '/hats'],
        },
        {
          name: 'Settings',
          router: '/settings',
          icon: <Cog6ToothIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: 'Shift + ,',
        },
      ],
    },
  ];

  const getSidebarForPathname = (pathname: string): RIGHT_SIDEBAR_ENUM => {
    switch (pathname) {
      case '/feeds':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR;
      case '/post':
        return RIGHT_SIDEBAR_ENUM.PUBLISHED_CASTS;
      case '/channels':
        return RIGHT_SIDEBAR_ENUM.NONE;
      case '/notifications':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO;
      case '/search':
        return RIGHT_SIDEBAR_ENUM.SEARCH;
      case '/profile/[slug]':
      case '/conversation/[...slug]':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  };

  const getTitle = (navItem) => {
    if (navItem) {
      return navItem.getTitle ? navItem.getTitle() : navItem.name;
    } else {
      if (pathname === '/profile/[slug]') {
        return 'Profile';
      } else if (pathname === '/conversation/[...slug]') {
        return 'Conversation';
      }
    }
  };

  const getHeaderActions = (navItem) => {
    return navItem?.getHeaderActions ? navItem.getHeaderActions() : [];
  };

  const getNavItem = (pathname: string) => {
    return navigationGroups
      .map((group) => group.items)
      .flat()
      .find((item) => item.router === pathname);
  };

  const navItem = getNavItem(pathname);
  const title = getTitle(navItem);
  const headerActions = getHeaderActions(navItem);
  const sidebarType = getSidebarForPathname(pathname);

  const renderRightSidebar = () => {
    switch (sidebarType) {
      case RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR:
        return <RightSidebar showFeeds showLists showAuthorInfo />;
      case RIGHT_SIDEBAR_ENUM.CAST_INFO:
        return <RightSidebar showAuthorInfo />;
      case RIGHT_SIDEBAR_ENUM.PUBLISHED_CASTS:
        return <PublishedCastsRightSidebar />;
      case RIGHT_SIDEBAR_ENUM.SEARCH:
        return <RightSidebar showManageLists showSearches showAuthorInfo />;
      case RIGHT_SIDEBAR_ENUM.NONE:
      default:
        return null;
    }
  };

  const renderUpgradeCard = () => (
    <Card>
      <CardHeader className="p-2 pt-0 md:p-4">
        <CardTitle>Create your herocast account</CardTitle>
        <CardDescription>Connect your email to unlock all features and start casting with herocast.</CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
        <Link href="/login?signupOnly=true" passHref>
          <Button size="sm" className="w-full">
            Connect email
          </Button>
        </Link>
      </CardContent>
    </Card>
  );

  const renderFinishOnboardingCard = () => (
    <Card>
      <CardHeader className="p-2 pt-0 md:p-4">
        <CardTitle>Finish your herocast setup</CardTitle>
        <CardDescription>Complete the onboarding to enjoy the full herocast experience. </CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
        <Link href="/welcome/success" passHref>
          <Button size="sm" className="w-full">
            Let&apos;s go
          </Button>
        </Link>
      </CardContent>
    </Card>
  );

  if (pathname === '/login') {
    return children;
  }

  const renderNewCastModal = () =>
    castModalDraftId !== undefined && (
      <NewCastModal
        draftId={castModalDraftId}
        open={isNewCastModalOpen}
        setOpen={(isOpen) => (isOpen ? openNewCastModal() : closeNewCastModal())}
      />
    );

  return (
    <div className="h-full bg-background">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-5 lg:hidden" onClose={() => setSidebarOpen(false)}>
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
                {/* Sidebar component, swap this element with another sidebar if you like */}
                <div className="mt-16 z-100 flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 ring-1 ring-gray-700/10">
                  <nav className="flex flex-1 flex-col divide-y divide-muted-foreground/20">
                    {navigationGroups.map((group) => {
                      const navigation = group.items;
                      return (
                        <div key={`nav-group-mobile-${group.name}`}>
                          <ul role="list" className="flex flex-1 flex-col gap-y-7">
                            <li>
                              <ul role="list" className="-mx-2 space-y-1">
                                {navigation.map(
                                  (item) =>
                                    !item.hide && (
                                      <li key={item.name}>
                                        <Link href={item.router} onClick={() => setSidebarOpen(false)}>
                                          <p
                                            className={cn(
                                              item.router === pathname || item.additionalPaths?.includes(pathname)
                                                ? 'text-background bg-foreground dark:text-foreground/60 dark:bg-foreground/10 dark:hover:text-foreground'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                              'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold cursor-pointer'
                                            )}
                                          >
                                            {item.icon}
                                            {item.name}
                                          </p>
                                        </Link>
                                      </li>
                                    )
                                )}
                              </ul>
                            </li>
                          </ul>
                        </div>
                      );
                    })}
                    <div className="w-full flex flex-row py-4">
                      <AccountSwitcher />
                      <ThemeToggle />
                    </div>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
      <div className="container mx-auto">
        <div className="grid grid-cols-[1fr] lg:grid-cols-[13rem_1fr]">
          {/* Static sidebar for desktop */}
          {/* <div className="hidden lg:fixed lg:inset-y-0 lg:z-5 lg:flex lg:w-48 lg:flex-col"> */}
          <div className="hidden lg:flex lg:grow lg:sticky lg:h-screen lg:inset-y-0 lg:left-0 lg:z-10 lg:full lg:overflow-y-auto lg:bg-background border-r border-muted">
            {/* Sidebar component, swap this element with another sidebar if you like */}
            <div className="flex grow flex-col flex-1 gap-y-5 overflow-y-auto bg-background px-6">
              <Link href="/post" className="flex h-16 shrink-0 items-center hover:cursor-pointer">
                <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:tracking-tight">herocast</h2>
              </Link>
              <div className="flex flex-col justify-between">
                <nav className="mt-0 divide-y divide-muted-foreground/20">
                  {navigationGroups.map((group) => {
                    const navigation = group.items;
                    return (
                      <div key={`nav-group-${group.name}`}>
                        {navigation.map(
                          (item) =>
                            !item.hide && (
                              <ul
                                key={`nav-item-${item.name}`}
                                role="list"
                                className="flex flex-col items-left space-y-1"
                              >
                                <li key={item.name}>
                                  <Link href={item.router}>
                                    <div
                                      className={cn(
                                        item.router === pathname || item.additionalPaths?.includes(pathname)
                                          ? 'text-background bg-foreground dark:text-foreground/60 dark:bg-foreground/10 dark:hover:text-foreground'
                                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                        'group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold cursor-pointer'
                                      )}
                                    >
                                      {item.icon}
                                      <span className="">{item.name}</span>
                                    </div>
                                  </Link>
                                </li>
                              </ul>
                            )
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
              {isReadOnlyUser && renderUpgradeCard()}
              {!isReadOnlyUser && !hasFinishedOnboarding && renderFinishOnboardingCard()}
              <div className="mt-auto flex flex-row lg:space-x-2 py-4">
                <AccountSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr] md:grid-cols-[1fr_12rem] lg:grid-cols-[1fr_16rem] relative">
            <div
              className={
                sidebarType === RIGHT_SIDEBAR_ENUM.NONE
                  ? 'md:col-span-2 w-full overflow-x-auto'
                  : 'w-full overflow-x-auto'
              }
            >
              {/* Sticky header */}
              {(title || headerActions) && (
                <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-6 md:gap-x-0 border-b border-muted bg-background px-4 sm:px-6 md:px-4">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5 text-foreground lg:hidden"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                  >
                    <span className="sr-only">Open sidebar</span>
                    <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <h1 className="ml-4 text-xl font-bold leading-7 text-foreground">{title}</h1>
                  <div className="flex-grow" />
                  <div className="flex gap-x-2">
                    {headerActions.map((action) => (
                      <Button size="sm" variant="outline" key={`header-action-${action.name}`} onClick={action.onClick}>
                        {action.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="w-full">
                {pageRequiresHydrate && !isHydrated ? (
                  <Loading className="ml-8" loadingMessage={loadingMessages[currentMessageIndex]} />
                ) : (
                  <div className="w-full">{children}</div>
                )}
              </div>
            </div>
            {renderRightSidebar()}
          </div>
          {renderNewCastModal()}
          <Toaster theme="system" position="bottom-right" />
        </div>
      </div>
    </div>
  );
};

export default Home;
