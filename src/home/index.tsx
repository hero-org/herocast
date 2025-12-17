import React, { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpCircleIcon, Cog6ToothIcon, PencilSquareIcon, UserIcon } from '@heroicons/react/20/solid';
import {
  Bars3Icon,
  UserPlusIcon,
  BellIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { RIGHT_SIDEBAR_ENUM } from '../common/constants/navigation';
import LeftSidebarToggle from '@/common/components/Sidebar/LeftSidebarToggle';
import RightSidebarToggle from '@/common/components/Sidebar/RightSidebarToggle';
import { CUSTOM_CHANNELS, useAccountStore } from '@/stores/useAccountStore';
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
import { SidebarProvider } from '@/components/ui/sidebar';
import { Inbox } from 'lucide-react';
import LeftSidebarNav from '@/common/components/Sidebar/LeftSidebarNav';
import AuthorContextPanel from '@/common/components/Sidebar/AuthorContextPanel';

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
  hideTitlebar?: boolean;
};

type HeaderAction = {
  name: string | JSX.Element;
  onClick: () => void;
};

const Home = ({ children }: { children: React.ReactNode }) => {
  useInitializeStores();

  const pathname = usePathname() || '/';
  // In App Router, asPath is equivalent to pathname (no query string access from usePathname)
  const asPath = pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { allChannels, selectedChannelUrl, isHydrated, addPinnedChannel, removePinnedChannel } = useAccountStore();
  const {
    castModalDraftId,
    isNewCastModalOpen,
    openNewCastModal,
    closeNewCastModal,
    setCastModalView,
    setCastModalDraftId,
    leftSidebarOpen,
    rightSidebarOpen,
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
          name: 'Inbox',
          router: '/inbox',
          icon: <Inbox className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: 'Shift + N',
          hideTitlebar: true,
        },
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
            if (isChannelFeed && !isChannelPinned) {
              actions.push({
                name: 'Pin',
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
          icon: <PencilSquareIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          hideTitlebar: true,
        },
        {
          name: 'DMs',
          router: '/dms',
          icon: <ChatBubbleLeftRightIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: 'Shift + M',
          hideTitlebar: true,
        },
        {
          name: 'Lists',
          router: '/lists',
          icon: <UserGroupIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: 'Shift + L',
        },
        {
          name: 'Search',
          router: '/search',
          icon: <MagnifyingGlassIcon className="h-6 w-6 shrink-0" aria-hidden="true" />,
          shortcut: '/',
        },

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
          additionalPaths: ['/farcaster-signup'],
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
    // Handle dynamic routes first
    if (pathname.startsWith('/profile/')) {
      return RIGHT_SIDEBAR_ENUM.CAST_INFO;
    }
    if (pathname.startsWith('/conversation/')) {
      return RIGHT_SIDEBAR_ENUM.CAST_INFO;
    }
    if (pathname.startsWith('/miniapp/')) {
      return RIGHT_SIDEBAR_ENUM.NONE;
    }

    switch (pathname) {
      case '/feeds':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR;
      case '/post':
        return RIGHT_SIDEBAR_ENUM.NONE;
      case '/channels':
        return RIGHT_SIDEBAR_ENUM.NONE;
      case '/inbox':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO;
      case '/dms':
        return RIGHT_SIDEBAR_ENUM.CAST_INFO;
      case '/search':
        return RIGHT_SIDEBAR_ENUM.SEARCH;
      default:
        return RIGHT_SIDEBAR_ENUM.NONE;
    }
  };

  const getTitle = (navItem) => {
    if (navItem) {
      return navItem.getTitle ? navItem.getTitle() : navItem.name;
    } else {
      if (pathname.startsWith('/profile/')) {
        return 'Profile';
      } else if (pathname.startsWith('/conversation/')) {
        return 'Conversation';
      } else if (pathname.startsWith('/miniapp/')) {
        return 'Mini App';
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
  const hideTitlebar = navItem?.hideTitlebar || false;
  const headerActions = getHeaderActions(navItem);
  const sidebarType = getSidebarForPathname(pathname);

  const renderRightSidebar = () => {
    switch (sidebarType) {
      case RIGHT_SIDEBAR_ENUM.CAST_INFO_AND_CHANNEL_SELECTOR:
      case RIGHT_SIDEBAR_ENUM.CAST_INFO:
      case RIGHT_SIDEBAR_ENUM.SEARCH:
        return <AuthorContextPanel />;
      case RIGHT_SIDEBAR_ENUM.PUBLISHED_CASTS:
        return <PublishedCastsRightSidebar />;
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
    <div className="h-screen bg-background overflow-hidden">
      <SidebarProvider className="h-full">
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
                <Dialog.Panel className="relative mr-2 flex w-full max-w-xs flex-1">
                  {/* Mobile Sidebar */}
                  <div className="flex grow flex-col flex-1 gap-y-3 overflow-y-auto bg-background px-3 no-scrollbar">
                    <div className="flex h-14 shrink-0 items-center">
                      <Link href="/post" className="flex items-center hover:cursor-pointer">
                        <h2 className="text-xl font-bold leading-7 text-foreground sm:truncate sm:tracking-tight">
                          herocast
                        </h2>
                      </Link>
                      <button
                        type="button"
                        className="ml-auto -m-2.5 p-2.5 text-foreground"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>
                    <LeftSidebarNav onNavigate={() => setSidebarOpen(false)} />
                    {isReadOnlyUser && renderUpgradeCard()}
                    {!isReadOnlyUser && !hasFinishedOnboarding && isHydrated && renderFinishOnboardingCard()}
                    <div className="mt-auto py-3">
                      <AccountSwitcher />
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
        <div
          className={cn(
            'h-full transition-[margin-left] duration-200 ease-linear flex-1',
            leftSidebarOpen ? 'lg:ml-[200px]' : 'lg:ml-0'
          )}
        >
          <div className="h-full">
            {/* Static sidebar for desktop */}
            {/* <div className="hidden lg:fixed lg:inset-y-0 lg:z-5 lg:flex lg:w-48 lg:flex-col"> */}
            <div
              className={cn(
                'hidden lg:flex lg:fixed lg:h-screen lg:inset-y-0 lg:left-0 lg:z-10 lg:w-[200px] lg:flex-shrink-0 lg:overflow-y-auto lg:bg-background border-r border-muted no-scrollbar transition-transform duration-200 ease-linear',
                leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            >
              {/* Sidebar component */}
              <div className="flex grow flex-col flex-1 gap-y-3 overflow-y-auto bg-background px-3 no-scrollbar">
                <div className="flex h-14 shrink-0 items-center">
                  <Link href="/post" className="flex items-center hover:cursor-pointer">
                    <h2 className="text-xl font-bold leading-7 text-foreground sm:truncate sm:tracking-tight">
                      herocast
                    </h2>
                  </Link>
                  <LeftSidebarToggle className="ml-auto" />
                </div>
                <LeftSidebarNav />
                {isReadOnlyUser && renderUpgradeCard()}
                {!isReadOnlyUser && !hasFinishedOnboarding && isHydrated && renderFinishOnboardingCard()}
                <div className="mt-auto py-3">
                  <AccountSwitcher />
                </div>
              </div>
            </div>
            <div className="h-full flex">
              <div className="flex-1 h-full flex flex-col min-w-0 min-h-0">
                {/* Header */}
                {!hideTitlebar && (title || headerActions) && (
                  <div className="flex h-16 flex-shrink-0 items-center gap-x-6 md:gap-x-0 border-b border-muted bg-background px-4 sm:px-6 md:px-4 min-w-0">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5 text-foreground lg:hidden flex-shrink-0"
                      onClick={() => setSidebarOpen((prev) => !prev)}
                    >
                      <span className="sr-only">Open sidebar</span>
                      <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {!leftSidebarOpen && <LeftSidebarToggle className="hidden lg:flex" />}
                    <h1 className="md:ml-2 text-xl font-bold leading-7 text-foreground truncate min-w-0">{title}</h1>
                    <div className="flex-grow min-w-[40px]" />
                    <div className="flex gap-x-2 flex-shrink-0">
                      {headerActions.map((action) => (
                        <Button
                          size="sm"
                          variant="outline"
                          key={`header-action-${action.name}`}
                          onClick={action.onClick}
                        >
                          {action.name}
                        </Button>
                      ))}
                      {sidebarType !== RIGHT_SIDEBAR_ENUM.NONE && <RightSidebarToggle className="hidden lg:flex" />}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {pageRequiresHydrate && !isHydrated ? (
                    <div className="pl-4">
                      <Loading loadingMessage="Loading herocast" />
                    </div>
                  ) : (
                    <div className={cn('h-full', pathname === '/accounts' ? 'overflow-y-auto' : 'overflow-hidden')}>
                      {children}
                    </div>
                  )}
                </div>
              </div>
              {sidebarType !== RIGHT_SIDEBAR_ENUM.NONE && (
                <div
                  className={cn(
                    'hidden lg:block flex-shrink-0 transition-[width,opacity] duration-200 ease-linear overflow-hidden',
                    rightSidebarOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0'
                  )}
                >
                  {renderRightSidebar()}
                </div>
              )}
            </div>
            {renderNewCastModal()}
          </div>
        </div>
      </SidebarProvider>
      <Toaster theme="system" position="bottom-right" />
    </div>
  );
};

export default Home;
