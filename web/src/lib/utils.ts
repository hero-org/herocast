import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Verbatim port of the repo-root src/lib/utils.ts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
