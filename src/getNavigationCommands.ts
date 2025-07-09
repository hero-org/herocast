import { NextRouter } from 'next/router';
import { CommandType } from './common/constants/commands';
import { ChartBarIcon, MagnifyingGlassIcon, RectangleGroupIcon } from '@heroicons/react/20/solid';
import { BellIcon, HashtagIcon } from '@heroicons/react/24/outline';
import { Bars3BottomLeftIcon } from '@heroicons/react/20/solid';
import { Cog6ToothIcon, UserPlusIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface WithRouterProps {
  router: NextRouter;
}

export const getNavigationCommands = ({ router }: WithRouterProps): CommandType[] => [
  {
    name: 'Accounts',
    aliases: ['new account', 'sign up'],
    icon: UserPlusIcon,
    shortcut: 'meta+shift+a',
    action: () => router.push('/accounts'),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: 'Switch to Feeds',
    aliases: ['scroll'],
    icon: Bars3BottomLeftIcon,
    shortcut: 'shift+f',
    action: () => router.push('/feeds'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Switch to Search',
    aliases: ['search'],
    icon: MagnifyingGlassIcon,
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
    icon: RectangleGroupIcon,
    shortcut: 'shift+c',
    action: () => router.push('/channels'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Notifications',
    aliases: ['notify', 'alert', 'mentions', 'replies', 'messages', 'inbox'],
    icon: BellIcon,
    shortcut: 'shift+n',
    action: () => router.push('/inbox'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Direct Messages',
    aliases: ['dms', 'messages', 'chats', 'direct', 'dm'],
    icon: ChatBubbleLeftRightIcon,
    shortcut: 'shift+m',
    action: () => router.push('/dms'),
    options: {
      enableOnFormTags: false,
    },
  },
  {
    name: 'Inbox: Switch to Replies',
    aliases: ['inbox replies', 'notification replies'],
    icon: HashtagIcon,
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
    icon: HashtagIcon,
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
    icon: HashtagIcon,
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
    icon: HashtagIcon,
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
    icon: HashtagIcon,
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
    icon: Cog6ToothIcon,
    shortcut: 'cmd+shift+,',
    action: () => router.push('/settings'),
    options: {
      enableOnFormTags: true,
    },
  },
  {
    name: 'Analytics',
    aliases: ['stats', 'insights', 'data', 'metrics', 'report'],
    icon: ChartBarIcon,
    action: () => router.push('/analytics'),
  },
  {
    name: 'Report a Bug',
    aliases: ['bug', 'issue', 'feedback', 'suggestion', 'complaint'],
    icon: BellIcon,
    action: () =>
      window.open(
        'https://github.com/hero-org/herocast/issues/new?assignees=&labels=&projects=&template=bug_report.md&title='
      ),
    options: {
      enableOnFormTags: false,
    },
  },
];
