import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'herocast-sidebar-collapse-state';

export type SectionKey = 'feeds' | 'searches' | 'lists' | 'channels';

type CollapseState = Record<SectionKey, boolean>;

const DEFAULT_STATE: CollapseState = {
  feeds: true, // collapsed by default
  searches: true, // collapsed by default
  lists: true, // collapsed by default
  channels: true, // collapsed by default
};

export function useSidebarCollapseState() {
  const [collapseState, setCollapseState] = useState<CollapseState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CollapseState>;
        setCollapseState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load sidebar collapse state:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage on change
  const toggleSection = useCallback((section: SectionKey) => {
    setCollapseState((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save sidebar collapse state:', e);
      }
      return next;
    });
  }, []);

  const setSection = useCallback((section: SectionKey, isCollapsed: boolean) => {
    setCollapseState((prev) => {
      const next = { ...prev, [section]: isCollapsed };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save sidebar collapse state:', e);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (section: SectionKey) => {
      return collapseState[section];
    },
    [collapseState]
  );

  return {
    collapseState,
    isCollapsed,
    toggleSection,
    setSection,
    isHydrated,
  };
}
