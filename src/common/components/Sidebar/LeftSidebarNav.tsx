import {
  Hash,
  Inbox,
  LayoutPanelLeft,
  List,
  MessageCircle,
  Newspaper,
  PenSquare,
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

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  additionalPaths?: string[];
};

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
  {
    name: 'Lists',
    href: '/lists',
    icon: <List className="h-5 w-5" />,
  },
  {
    name: 'Channels',
    href: '/channels',
    icon: <Hash className="h-5 w-5" />,
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

const LeftSidebarNav = ({ onNavigate }: LeftSidebarNavProps) => {
  const pathname = usePathname() || '/';

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
              ? 'bg-foreground text-background dark:bg-foreground/10 dark:text-foreground'
              : 'text-foreground/70 hover:text-foreground hover:bg-muted'
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom navigation */}
      <div className="space-y-0.5">{bottomNavItems.map(renderNavItem)}</div>
    </nav>
  );
};

export default LeftSidebarNav;
