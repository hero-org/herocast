import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAccountStore, CUSTOM_CHANNELS } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { useSidebarCollapseState } from '@/common/hooks/useSidebarCollapseState';
import CollapsibleNavSection, { NavItem } from './CollapsibleNavSection';
import { Button } from '@/components/ui/button';
import {
  Inbox,
  Newspaper,
  PenSquare,
  MessageCircle,
  Search,
  User,
  Settings,
  ArrowUpCircle,
  UserPlus,
  Home,
  TrendingUp,
  Hash,
  Rss,
  Users,
} from 'lucide-react';

type MainNavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  additionalPaths?: string[];
};

const mainNavItems: MainNavItem[] = [
  {
    name: 'Inbox',
    href: '/inbox',
    icon: <Inbox className="h-5 w-5" />,
    shortcut: '⇧N',
  },
  {
    name: 'Feeds',
    href: '/feeds',
    icon: <Newspaper className="h-5 w-5" />,
    shortcut: '⇧F',
    additionalPaths: ['/conversation'],
  },
  {
    name: 'Post',
    href: '/post',
    icon: <PenSquare className="h-5 w-5" />,
  },
  {
    name: 'DMs',
    href: '/dms',
    icon: <MessageCircle className="h-5 w-5" />,
    shortcut: '⇧M',
  },
  {
    name: 'Search',
    href: '/search',
    icon: <Search className="h-5 w-5" />,
    shortcut: '/',
  },
];

const settingsNavItems: MainNavItem[] = [
  {
    name: 'Profile',
    href: '/profile',
    icon: <User className="h-5 w-5" />,
    additionalPaths: ['/profile/'],
  },
  {
    name: 'Upgrade',
    href: '/upgrade',
    icon: <ArrowUpCircle className="h-5 w-5" />,
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: <UserPlus className="h-5 w-5" />,
    shortcut: '⌘⇧A',
    additionalPaths: ['/farcaster-signup'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    shortcut: '⇧,',
  },
];

const LeftSidebarNav = () => {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { collapseState, toggleSection } = useSidebarCollapseState();

  // Get data from stores
  const { selectedChannelUrl, setSelectedChannelUrl } = useAccountStore();
  const channels = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.channels || []);
  const { selectedListId, setSelectedListId, getSearchLists, getFidLists } = useListStore();

  const searchLists = getSearchLists();
  const fidLists = getFidLists();

  // Check if a nav item is active
  const isNavItemActive = (item: MainNavItem) => {
    if (pathname === item.href) return true;
    if (item.additionalPaths) {
      return item.additionalPaths.some((p) => pathname.startsWith(p));
    }
    return false;
  };

  // Handle feed selection
  const handleFeedSelect = (feedUrl: string) => {
    setSelectedChannelUrl(feedUrl);
    setSelectedListId(undefined);
    if (pathname !== '/feeds') {
      router.push('/feeds');
    }
  };

  // Handle list selection
  const handleListSelect = (listId: string) => {
    setSelectedListId(listId as any);
    setSelectedChannelUrl(null);
    if (pathname !== '/feeds') {
      router.push('/feeds');
    }
  };

  // Handle channel selection
  const handleChannelSelect = (channelUrl: string) => {
    setSelectedChannelUrl(channelUrl);
    setSelectedListId(undefined);
    if (pathname !== '/feeds') {
      router.push('/feeds');
    }
  };

  // Build feed items
  const feedItems: NavItem[] = [
    {
      id: CUSTOM_CHANNELS.FOLLOWING,
      name: 'Following',
      icon: <Home className="h-4 w-4" />,
      shortcut: '⇧0',
      onClick: () => handleFeedSelect(CUSTOM_CHANNELS.FOLLOWING),
    },
    {
      id: CUSTOM_CHANNELS.TRENDING,
      name: 'Trending',
      icon: <TrendingUp className="h-4 w-4" />,
      shortcut: '⇧1',
      onClick: () => handleFeedSelect(CUSTOM_CHANNELS.TRENDING),
    },
  ];

  // Build search list items
  const searchItems: NavItem[] = searchLists.map((list) => ({
    id: list.id,
    name: list.name,
    icon: <Search className="h-4 w-4" />,
    onClick: () => handleListSelect(list.id),
  }));

  // Build fid list items
  const listItems: NavItem[] = fidLists.map((list) => ({
    id: list.id,
    name: list.name,
    icon: <Users className="h-4 w-4" />,
    onClick: () => handleListSelect(list.id),
  }));

  // Build channel items
  const channelItems: NavItem[] = channels.map((channel) => ({
    id: channel.url,
    name: channel.name,
    icon: channel.icon_url ? (
      <img src={channel.icon_url} alt="" className="h-4 w-4 rounded-full" />
    ) : (
      <Hash className="h-4 w-4" />
    ),
    onClick: () => handleChannelSelect(channel.url),
  }));

  // Determine what's selected
  const getSelectedFeedId = () => {
    if (selectedListId) return undefined;
    return selectedChannelUrl || undefined;
  };

  const getSelectedListId = () => {
    if (!selectedListId) return undefined;
    // Check if it's a search list or fid list
    const isSearch = searchLists.some((l) => l.id === selectedListId);
    const isFid = fidLists.some((l) => l.id === selectedListId);
    if (isSearch || isFid) return selectedListId;
    return undefined;
  };

  const renderMainNavItem = (item: MainNavItem) => {
    const isActive = isNavItemActive(item);
    return (
      <Link key={item.href} href={item.href}>
        <div
          className={cn(
            'group flex items-center gap-x-3 rounded-md px-2 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            isActive
              ? 'bg-foreground text-background dark:bg-foreground/10 dark:text-foreground'
              : 'text-foreground/70 hover:text-foreground hover:bg-muted'
          )}
        >
          {item.icon}
          <span className="flex-1 truncate">{item.name}</span>
          {item.shortcut && (
            <kbd
              className={cn(
                'px-1 py-0.5 rounded text-[10px] font-mono transition-opacity',
                isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-50'
              )}
            >
              {item.shortcut}
            </kbd>
          )}
        </div>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col flex-1 gap-y-1 overflow-y-auto">
      {/* Main navigation */}
      <div className="space-y-0.5">{mainNavItems.map(renderMainNavItem)}</div>

      {/* Separator */}
      <div className="my-2 border-t border-sidebar-border/20" />

      {/* Feeds section */}
      <CollapsibleNavSection
        title="Feeds"
        icon={<Rss className="h-3 w-3" />}
        items={feedItems}
        isCollapsed={collapseState.feeds}
        onToggle={() => toggleSection('feeds')}
        onItemClick={() => {}}
        selectedId={getSelectedFeedId()}
      />

      {/* Searches section */}
      <CollapsibleNavSection
        title="Searches"
        icon={<Search className="h-3 w-3" />}
        items={searchItems}
        isCollapsed={collapseState.searches}
        onToggle={() => toggleSection('searches')}
        shortcutPrefix="g s"
        onItemClick={() => {}}
        selectedId={getSelectedListId()}
        emptyState={
          <Link href="/lists?tab=search" className="block px-3">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
              + Add search
            </Button>
          </Link>
        }
        footer={
          searchItems.length > 0 && (
            <Link href="/lists?tab=search">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                + Add
              </Button>
            </Link>
          )
        }
      />

      {/* Lists section */}
      <CollapsibleNavSection
        title="Lists"
        icon={<Users className="h-3 w-3" />}
        items={listItems}
        isCollapsed={collapseState.lists}
        onToggle={() => toggleSection('lists')}
        shortcutPrefix="g l"
        onItemClick={() => {}}
        selectedId={getSelectedListId()}
        emptyState={
          <Link href="/lists?tab=users" className="block px-3">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
              + Add list
            </Button>
          </Link>
        }
        footer={
          listItems.length > 0 && (
            <div className="flex gap-x-1">
              <Link href="/lists" className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Manage
                </Button>
              </Link>
              <Link href="/lists?tab=users" className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  + Add
                </Button>
              </Link>
            </div>
          )
        }
      />

      {/* Channels section */}
      <CollapsibleNavSection
        title="Channels"
        icon={<Hash className="h-3 w-3" />}
        items={channelItems}
        isCollapsed={collapseState.channels}
        onToggle={() => toggleSection('channels')}
        onItemClick={() => {}}
        selectedId={getSelectedFeedId()}
        emptyState={
          <Link href="/channels" className="block px-3">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground">
              + Pin channels
            </Button>
          </Link>
        }
        footer={
          channelItems.length > 0 && (
            <Link href="/channels">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                + Pin
              </Button>
            </Link>
          )
        }
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Separator */}
      <div className="my-2 border-t border-sidebar-border/20" />

      {/* Settings navigation */}
      <div className="space-y-0.5">{settingsNavItems.map(renderMainNavItem)}</div>
    </nav>
  );
};

export default LeftSidebarNav;
