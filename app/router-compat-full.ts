'use client';

import { 
  useRouter as useNavigationRouter, 
  usePathname, 
  useSearchParams, 
  useParams 
} from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, Suspense } from 'react';

// Types matching next/router exactly
export interface NextRouter {
  route: string;
  pathname: string;
  query: { [key: string]: string | string[] | undefined };
  asPath: string;
  basePath: string;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  domainLocales?: Array<{
    domain: string;
    defaultLocale: string;
    locales?: string[];
  }>;
  isLocaleDomain: boolean;
  isReady: boolean;
  isPreview: boolean;
  isFallback: boolean;
  
  // Navigation methods
  push(url: string, as?: string, options?: TransitionOptions): Promise<boolean>;
  replace(url: string, as?: string, options?: TransitionOptions): Promise<boolean>;
  reload(): void;
  back(): void;
  forward(): void;
  prefetch(url: string, asPath?: string, options?: PrefetchOptions): Promise<void>;
  beforePopState(cb: BeforePopStateCallback): void;
  
  // Events
  events: RouterEvents;
}

export interface TransitionOptions {
  shallow?: boolean;
  locale?: string | false;
  scroll?: boolean;
  unstable_skipClientCache?: boolean;
}

export interface PrefetchOptions {
  priority?: boolean;
  locale?: string | false;
}

export type BeforePopStateCallback = (state: any) => boolean;

export interface RouterEvents {
  on(type: string, handler: (...args: any[]) => void): void;
  off(type: string, handler: (...args: any[]) => void): void;
  emit(type: string, ...args: any[]): void;
}

// Event names that next/router supports
export const ROUTER_EVENTS = {
  ROUTE_CHANGE_START: 'routeChangeStart',
  ROUTE_CHANGE_COMPLETE: 'routeChangeComplete',
  ROUTE_CHANGE_ERROR: 'routeChangeError',
  BEFORE_HISTORY_CHANGE: 'beforeHistoryChange',
  HASH_CHANGE_START: 'hashChangeStart',
  HASH_CHANGE_COMPLETE: 'hashChangeComplete',
} as const;

// Global event emitter for router events
class RouterEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  on(type: string, handler: (...args: any[]) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  off(type: string, handler: (...args: any[]) => void) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  emit(type: string, ...args: any[]) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Router event handler error for ${type}:`, error);
        }
      });
    }
  }

  clear() {
    this.listeners.clear();
  }
}

// Global singleton event emitter
const globalEventEmitter = new RouterEventEmitter();

// Custom hook to create the router object
function useAppRouterCompat(): NextRouter {
  const navigationRouter = useNavigationRouter();
  const pathname = usePathname();
  const params = useParams();
  
  // Lazy access to searchParams to avoid SSR issues
  // This will only be accessed when query or asPath is accessed
  const getSearchParams = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return null;
    }
  }, []);
  const beforePopStateRef = useRef<BeforePopStateCallback | null>(null);

  // Parse query parameters including dynamic route params
  const query = useMemo(() => {
    const queryObj: { [key: string]: string | string[] | undefined } = {};
    
    // Add search params lazily
    const searchParams = getSearchParams();
    if (searchParams) {
      for (const [key, value] of searchParams.entries()) {
        // Handle multiple values for the same key
        if (queryObj[key]) {
          const existing = queryObj[key];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            queryObj[key] = [existing as string, value];
          }
        } else {
          queryObj[key] = value;
        }
      }
    }

    // Add dynamic route params
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        queryObj[key] = value;
      });
    }

    return queryObj;
  }, [getSearchParams, params]);

  // Construct asPath (pathname + search params)
  const asPath = useMemo(() => {
    const searchParams = getSearchParams();
    if (!searchParams || searchParams.size === 0) {
      return pathname;
    }
    return `${pathname}?${searchParams.toString()}`;
  }, [pathname, getSearchParams]);

  // Enhanced push with event emission
  const push = useCallback(async (url: string, as?: string, options?: TransitionOptions): Promise<boolean> => {
    try {
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_START, as || url, { shallow: options?.shallow });
      
      await navigationRouter.push(url, {
        scroll: options?.scroll !== false,
      });
      
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_COMPLETE, as || url, { shallow: options?.shallow });
      return true;
    } catch (error) {
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_ERROR, error, as || url, { shallow: options?.shallow });
      return false;
    }
  }, [navigationRouter]);

  // Enhanced replace with event emission
  const replace = useCallback(async (url: string, as?: string, options?: TransitionOptions): Promise<boolean> => {
    try {
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_START, as || url, { shallow: options?.shallow });
      
      await navigationRouter.replace(url, {
        scroll: options?.scroll !== false,
      });
      
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_COMPLETE, as || url, { shallow: options?.shallow });
      return true;
    } catch (error) {
      globalEventEmitter.emit(ROUTER_EVENTS.ROUTE_CHANGE_ERROR, error, as || url, { shallow: options?.shallow });
      return false;
    }
  }, [navigationRouter]);

  // Enhanced reload
  const reload = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Enhanced back with event support
  const back = useCallback(() => {
    if (beforePopStateRef.current) {
      const shouldProceed = beforePopStateRef.current({ url: window.location.href });
      if (!shouldProceed) return;
    }
    navigationRouter.back();
  }, [navigationRouter]);

  // Enhanced forward
  const forward = useCallback(() => {
    navigationRouter.forward();
  }, [navigationRouter]);

  // Enhanced prefetch
  const prefetch = useCallback(async (url: string, asPath?: string, options?: PrefetchOptions): Promise<void> => {
    try {
      await navigationRouter.prefetch(url);
    } catch (error) {
      console.warn('Prefetch failed:', error);
    }
  }, [navigationRouter]);

  // beforePopState implementation
  const beforePopState = useCallback((cb: BeforePopStateCallback) => {
    beforePopStateRef.current = cb;
  }, []);

  // Router events object
  const events: RouterEvents = useMemo(() => ({
    on: (type: string, handler: (...args: any[]) => void) => {
      globalEventEmitter.on(type, handler);
    },
    off: (type: string, handler: (...args: any[]) => void) => {
      globalEventEmitter.off(type, handler);
    },
    emit: (type: string, ...args: any[]) => {
      globalEventEmitter.emit(type, ...args);
    },
  }), []);

  // Handle browser back/forward events
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (beforePopStateRef.current) {
        const shouldProceed = beforePopStateRef.current(event.state);
        if (!shouldProceed) {
          event.preventDefault();
          return;
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Return the complete router object
  return useMemo(() => ({
    route: pathname,
    pathname,
    query,
    asPath,
    basePath: '',
    locale: undefined,
    locales: undefined,
    defaultLocale: undefined,
    domainLocales: undefined,
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    isFallback: false,
    
    // Methods
    push,
    replace,
    reload,
    back,
    forward,
    prefetch,
    beforePopState,
    
    // Events
    events,
  }), [
    pathname,
    query,
    asPath,
    push,
    replace,
    reload,
    back,
    forward,
    prefetch,
    beforePopState,
    events,
  ]);
}

// Main useRouter hook that matches next/router API exactly
export function useRouter(): NextRouter {
  return useAppRouterCompat();
}

// withRouter HOC compatibility (deprecated in App Router but included for completeness)
// Note: withRouter is not supported in this compatibility layer as it requires JSX
// It's deprecated in App Router anyway - use useRouter hook instead
export const withRouter = (Component: any) => {
  console.warn('withRouter is deprecated in App Router. Use useRouter hook instead.');
  return Component;
};

// Default export for the compatibility module
export default {
  useRouter,
  withRouter,
};

// Re-export types for full compatibility
export type { TransitionOptions, PrefetchOptions, BeforePopStateCallback, RouterEvents };

// ROUTER_EVENTS is already exported above

// Clean up function for testing or unmounting
export const cleanupRouterEvents = () => {
  globalEventEmitter.clear();
};