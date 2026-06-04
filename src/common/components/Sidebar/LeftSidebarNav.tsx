import {
  Inbox,
  LayoutPanelLeft,
  MessageCircle,
  Newspaper,
  PenSquare,
  Plus,
  Search,
  Settings,
  User,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { cn } from '@/lib/utils';
import { renderShortcut } from './CollapsibleNavSection';
import { SidebarFeedList } from './feeds/SidebarFeedList';
import { SidebarFeedSection } from './feeds/SidebarFeedSection';
import { useCollapsedSections } from './feeds/useCollapsedSections';
import { useSidebarFeeds } from './feeds/useSidebarFeeds';

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  additionalPaths?: string[];
};

// Lists & Channels are no longer flat links — they live as collapsible groups in
// the feeds disclosure below, surfacing the user's actual channels and lists.
const mainNavItems: NavItem[] = [
  {
    name: 'Feeds',
    href: '/feeds',
    icon: <Newspaper className="h-5 w-5" />,
    shortcut: '⇧F',
    additionalPaths: ['/conversation'],
  },
  {
    name: 'Inbox',
    href: '/inbox',
    icon: <Inbox className="h-5 w-5" />,
    shortcut: '⇧N',
  },
  {
    name: 'Workspace',
    href: '/workspace',
    icon: <LayoutPanelLeft className="h-5 w-5" />,
    shortcut: '⇧W',
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

const bottomNavItems: NavItem[] = [
  {
    name: 'Profile',
    href: '/profile',
    icon: <User className="h-5 w-5" />,
    additionalPaths: ['/profile/'],
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

type LeftSidebarNavProps = {
  onNavigate?: () => void;
};

/** Footer action under a feeds group — links to the relevant management page. */
function SectionFooterLink({
  href,
  label,
  onNavigate,
  active,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
  active?: boolean;
}) {
  return (
    <Link href={href} onClick={onNavigate}>
      <span
        className={cn(
          'flex items-center gap-x-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </span>
    </Link>
  );
}

const LeftSidebarNav = ({ onNavigate }: LeftSidebarNavProps) => {
  const pathname = usePathname() || '/';
  const { customFeeds, channels, lists, selectedId, isHydrated, selectFeed } = useSidebarFeeds(onNavigate);
  const { isOpen, toggle } = useCollapsedSections();

  const isActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (item.additionalPaths) {
      return item.additionalPaths.some((p) => pathname.startsWith(p));
    }
    return false;
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link key={item.href} href={item.href} onClick={onNavigate}>
        <div
          className={cn(
            'group flex items-center gap-x-3 rounded-md px-2 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            active
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-button-press'
              : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
          )}
        >
          {item.icon}
          <span className="flex-1 truncate">{item.name}</span>
          {item.shortcut && renderShortcut(item.shortcut, active)}
        </div>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col flex-1 gap-y-0.5 overflow-y-auto no-scrollbar">
      {/* Main navigation */}
      <div className="space-y-0.5">{mainNavItems.map(renderNavItem)}</div>

      {/* Feeds disclosure — custom feeds + collapsible Channels / Lists groups */}
      <div className="mx-1 my-1.5 h-px bg-sidebar-border/60" />
      <div className="space-y-0.5">
        <SidebarFeedList feeds={customFeeds} selectedId={selectedId} onSelect={selectFeed} />

        <SidebarFeedSection
          label="Channels"
          count={isHydrated ? channels.length : undefined}
          open={isOpen('channels')}
          onToggle={() => toggle('channels')}
          footer={
            <SectionFooterLink
              href="/channels"
              label="Pin channels"
              onNavigate={onNavigate}
              active={pathname.startsWith('/channels')}
            />
          }
        >
          <SidebarFeedList feeds={channels} selectedId={selectedId} onSelect={selectFeed} />
        </SidebarFeedSection>

        <SidebarFeedSection
          label="Lists"
          count={isHydrated ? lists.length : undefined}
          open={isOpen('lists')}
          onToggle={() => toggle('lists')}
          footer={
            <SectionFooterLink
              href="/lists"
              label="New list"
              onNavigate={onNavigate}
              active={pathname.startsWith('/lists')}
            />
          }
        >
          <SidebarFeedList feeds={lists} selectedId={selectedId} onSelect={selectFeed} />
        </SidebarFeedSection>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom navigation */}
      <div className="space-y-0.5">{bottomNavItems.map(renderNavItem)}</div>
    </nav>
  );
};

export default LeftSidebarNav;
