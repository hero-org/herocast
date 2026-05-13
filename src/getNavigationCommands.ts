import { AlignLeft, Bell, Hash, LayoutDashboard, MessagesSquare, Search, Settings, UserPlus } from 'lucide-react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { CommandType } from './common/constants/commands';

interface WithRouterProps {
  router: AppRouterInstance;
}

export const getNavigationCommands = ({ router }: WithRouterProps): CommandType[] => [
  {
    name: 'Accounts',
    aliases: ['new account', 'sign up'],
    icon: UserPlus,
    shortcut: 'meta+shift+a',
    action: () => router.push('/accounts'),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: 'Switch to Feeds',
    aliases: ['scroll'],
    icon: AlignLeft,
    shortcut: 'shift+f',
    action: () => router.push('/feeds'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Switch to Search',
    aliases: ['search'],
    icon: Search,
    shortcut: '/',
    action: () => router.push('/search'),
    options: {
      enableOnFormTags: false,
      preventDefault: true,
    },
  },
  {
    name: 'Switch to Channels',
    aliases: ['channels'],
    icon: LayoutDashboard,
    shortcut: 'shift+c',
    action: () => router.push('/channels'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Notifications',
    aliases: ['notify', 'alert', 'mentions', 'replies', 'messages', 'inbox'],
    icon: Bell,
    shortcut: 'shift+n',
    action: () => router.push('/inbox'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Direct Messages',
    aliases: ['dms', 'messages', 'chats', 'direct', 'dm'],
    icon: MessagesSquare,
    shortcut: 'shift+m',
    action: () => router.push('/dms'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Inbox: Switch to Replies',
    aliases: ['inbox replies', 'notification replies'],
    icon: Hash,
    shortcut: '1',
    action: () => router.push('/inbox?tab=replies'),
    options: {
      enableOnFormTags: false,
    },
    page: 'inbox',
  },
  {
    name: 'Inbox: Switch to Mentions',
    aliases: ['inbox mentions', 'notification mentions'],
    icon: Hash,
    shortcut: '2',
    action: () => router.push('/inbox?tab=mentions'),
    options: {
      enableOnFormTags: false,
    },
    page: 'inbox',
  },
  {
    name: 'Inbox: Switch to Likes',
    aliases: ['inbox likes', 'notification likes'],
    icon: Hash,
    shortcut: '3',
    action: () => router.push('/inbox?tab=likes'),
    options: {
      enableOnFormTags: false,
    },
    page: 'inbox',
  },
  {
    name: 'Inbox: Switch to Recasts',
    aliases: ['inbox recasts', 'notification recasts'],
    icon: Hash,
    shortcut: '4',
    action: () => router.push('/inbox?tab=recasts'),
    options: {
      enableOnFormTags: false,
    },
    page: 'inbox',
  },
  {
    name: 'Inbox: Switch to Follows',
    aliases: ['inbox follows', 'notification follows'],
    icon: Hash,
    shortcut: '5',
    action: () => router.push('/inbox?tab=follows'),
    options: {
      enableOnFormTags: false,
    },
    page: 'inbox',
  },
  {
    name: 'Settings',
    aliases: ['preferences', 'options', 'config'],
    icon: Settings,
    shortcut: 'cmd+shift+,',
    action: () => router.push('/settings'),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: 'Report a Bug',
    aliases: ['bug', 'issue', 'feedback', 'suggestion', 'complaint'],
    icon: Bell,
    action: () =>
      window.open(
        'https://github.com/hero-org/herocast/issues/new?assignees=&labels=&projects=&template=bug_report.md&title='
      ),
    options: {
      enableOnFormTags: false,
    },
  },
];
