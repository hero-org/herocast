import { NextRouter } from 'next/router'
import { CommandType } from './common/constants/commands';
import { ComputerDesktopIcon, MagnifyingGlassIcon, MoonIcon, RectangleGroupIcon, SunIcon } from '@heroicons/react/20/solid';
import { BellIcon } from '@heroicons/react/24/outline';
import { Bars3BottomLeftIcon } from "@heroicons/react/20/solid";
import { Cog6ToothIcon, UserPlusIcon } from "@heroicons/react/24/outline";

export const getThemeCommands = (setTheme: (theme: string) => void): CommandType[] => (
    [
        {
            name: 'Switch to Light Theme',
            aliases: ['bright'],
            icon: SunIcon,
            action: () => setTheme('light'),
        },
        {
            name: 'Switch to Dark Theme',
            aliases: ['dark'],
            icon: MoonIcon,
            action: () => setTheme('dark'),
        },
        {
            name: 'Switch to System Theme',
            aliases: ['system'],
            icon: ComputerDesktopIcon,
            action: () => setTheme('system'),
        },
    ]
)
