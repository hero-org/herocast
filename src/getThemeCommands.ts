import { Monitor, Moon, Repeat2, Sun } from 'lucide-react';
import type { CommandType } from './common/constants/commands';

export const getThemeCommands = (theme?: string, setTheme?: (theme: string) => void): CommandType[] =>
  theme && setTheme
    ? [
        {
          name: 'Switch to Light Theme',
          aliases: ['bright'],
          icon: Sun,
          action: () => setTheme('light'),
        },
        {
          name: 'Switch to Dark Theme',
          aliases: ['dark'],
          icon: Moon,
          action: () => setTheme('dark'),
        },
        {
          name: 'Switch to System Theme',
          aliases: ['system'],
          icon: Monitor,
          action: () => setTheme('system'),
        },
        {
          name: 'Toggle theme',
          icon: Repeat2,
          action: () => {
            if (theme === 'light') {
              setTheme('dark');
            } else {
              setTheme('light');
            }
          },
        },
      ]
    : [];
