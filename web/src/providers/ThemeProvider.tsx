import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

// Thin wrapper over next-themes, mirroring the repo-root
// src/common/hooks/ThemeProvider.tsx. next-themes works outside Next; it toggles
// `.dark` on <html>, which Tailwind's `darkMode: ['class']` reads.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
