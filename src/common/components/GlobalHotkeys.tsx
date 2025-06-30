import { useGlobalHotkeys } from '@/common/hooks/useGlobalHotkeys';

export function GlobalHotkeys() {
  // Register all global hotkeys (including cmd+k)
  useGlobalHotkeys();

  return null;
}