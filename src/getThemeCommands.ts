
import { CommandType } from './common/constants/commands';
import { ArrowPathRoundedSquareIcon, ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/20/solid';

export const getThemeCommands = (theme: string, setTheme: (theme: string) => void): CommandType[] => (
    [
        {
            name: 'Switch to Light Theme',
            aliases: ['bright', ],
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
        {
            name: 'Toggle theme',
            aliases: [],
            icon: ArrowPathRoundedSquareIcon,
            action: () => {
                if (theme === 'light') {
                    setTheme('dark');
                } else {
                    setTheme('light');
                }
            }
        }
    ]
)
