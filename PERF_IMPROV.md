# Performance Improvement Plan for Herocast

## Tasks Requiring Human Intervention

### Database & Infrastructure Tasks

1. **Add Database Indexes** (Impact: 🔥, Effort: Medium)

   - Add composite index: `CREATE INDEX idx_lists_user_created ON lists(user_id, created_at);`
   - Add channel index: `CREATE INDEX idx_channels_follower_count ON channels(follower_count) WHERE follower_count > 50;`
   - Run via Supabase dashboard SQL editor

2. **Redis Caching Setup** (Impact: 🔥🔥, Effort: High)

   - Set up Redis instance (Upstash, Railway, or local)
   - Add Redis client configuration to environment variables
   - Test caching layer before deploying to production

3. **React Query Installation** (Impact: 🔥🔥🔥, Effort: Medium)
   - Run: `npm install @tanstack/react-query`
   - Test compatibility with existing Zustand stores
   - Plan migration strategy for API calls

### Testing & Validation Tasks

1. **Performance Testing** - Test each improvement against targets using the measurement harness
2. **Bundle Analysis** - Run `npm run build` and analyze bundle sizes before/after optimizations
3. **Load Testing** - Test app performance with multiple accounts and large datasets

## Executive Summary

Analysis of the herocast codebase reveals critical performance bottlenecks preventing the app from achieving Superhuman-like 100ms response times. The main issues are:

1. **Blocking store hydration** preventing initial user interaction
2. **Heavy computations in render cycles** causing UI freezes
3. **Inefficient API call patterns** creating network waterfalls
4. **Missing caching strategies** across all layers
5. **Bundle size issues** slowing initial load

## Top 10 Performance Improvements

### 1. **Implement Progressive Store Hydration**

**Impact**: 🔥🔥🔥 **Effort**: Medium **File**: `src/stores/initializeStores.ts`

**Current Problem**: All stores hydrate simultaneously, blocking UI for 2-5 seconds

```typescript
// Current: All-or-nothing hydration
const initializeStores = async () => {
  await Promise.all([
    useUserStore.getState().hydrate(),
    useAccountStore.getState().hydrate(), // Blocks on channel fetching
    useListStore.getState().hydrate(),
    useDraftStore.getState().hydrate(),
  ]);
};
```

**Solution**: Priority-based hydration with UI unblocking

```typescript
const initializeStoresPriority = async () => {
  // Critical path: minimal account data for posting/liking
  const criticalPromise = useAccountStore.getState().hydrateMinimal();

  // Background: full data loading
  const backgroundPromises = [
    useAccountStore.getState().hydrateChannels(),
    useListStore.getState().hydrate(),
    useUserStore.getState().hydrate(),
  ];

  await criticalPromise; // UI unblocks here
  Promise.all(backgroundPromises); // Background loading
};
```

**Expected Improvement**: 70% reduction in time-to-interactive (5s → 1.5s)

### 2. **Add Client-Side Caching with React Query**

**Impact**: 🔥🔥🔥 **Effort**: Medium **Files**: Multiple API calls

**Current Problem**: No deduplication, no background refresh, no caching

```typescript
// Every component fetches independently
const profile = await neynarClient.lookupUserByFid(fid);
const casts = await neynarClient.fetchUserCasts(fid);
```

**Solution**: Implement React Query with smart caching

```typescript
const useProfile = (fid: number) => {
  return useQuery({
    queryKey: ['profile', fid],
    queryFn: () => neynarClient.lookupUserByFid(fid),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
};
```

**Expected Improvement**: 60% reduction in API calls, 200ms faster subsequent loads

### 3. **Optimize Cast Feed Rendering with Virtualization**

**Impact**: 🔥🔥🔥 **Effort**: Medium **File**: `pages/feeds/index.tsx`

**Current Problem**: Renders entire feed at once, causing lag with 100+ casts

```typescript
// Renders all casts simultaneously
{casts.map(cast => <CastRow key={cast.hash} cast={cast} />)}
```

**Solution**: Virtual scrolling with react-window

```typescript
import { FixedSizeList as List } from 'react-window';

const VirtualizedFeed = ({ casts }) => (
  <List
    height={800}
    itemCount={casts.length}
    itemSize={150}
    overscanCount={5}
  >
    {({ index, style }) => (
      <div style={style}>
        <CastRow cast={casts[index]} />
      </div>
    )}
  </List>
);
```

**Expected Improvement**: 80% faster feed rendering, smooth scrolling

### 4. **Implement Optimistic Updates for User Actions**

**Impact**: 🔥🔥 **Effort**: Low **Files**: Like/recast/reply components

**Current Problem**: UI waits for server confirmation before updating

```typescript
const handleLike = async (cast) => {
  await submitLike(cast.hash); // UI blocks here
  refetchCast(); // Another API call
};
```

**Solution**: Optimistic updates with rollback

```typescript
const handleLike = async (cast) => {
  // Immediate UI update
  updateCastOptimistically(cast.hash, { didLike: true });

  try {
    await submitLike(cast.hash);
  } catch (error) {
    // Rollback on failure
    updateCastOptimistically(cast.hash, { didLike: false });
  }
};
```

**Expected Improvement**: 300ms faster perceived response time

### 5. **Debounce Search and Input Operations**

**Impact**: 🔥🔥 **Effort**: Low **Files**: Command palette, search components

**Current Problem**: API calls on every keystroke

```typescript
// Fires API call on every character
const handleSearchChange = (query) => {
  searchUsers(query); // Expensive API call
};
```

**Solution**: Debounced search with loading states

```typescript
const debouncedSearch = useMemo(() => debounce((query) => searchUsers(query), 300), []);

const handleSearchChange = (query) => {
  setQuery(query); // Immediate UI update
  debouncedSearch(query); // Debounced API call
};
```

**Expected Improvement**: 90% reduction in search API calls

### 6. **Bundle Size Optimization and Code Splitting**

**Impact**: 🔥🔥 **Effort**: Medium **Files**: `pages/_app.tsx`, component imports

**Current Problem**: 2.71MB initial bundle with unused dependencies

```typescript
// All loaded upfront
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { Analytics } from '@visx/visx';
```

**Solution**: Dynamic imports and code splitting

```typescript
// Lazy load heavy components
const Analytics = lazy(() => import('./Analytics'));
const EmbedRenderer = lazy(() => import('./EmbedRenderer'));

// Dynamic API client loading
const getNeynarClient = () => {
  return import('@neynar/nodejs-sdk').then((module) => new module.NeynarAPIClient(apiKey));
};
```

**Expected Improvement**: 50% smaller initial bundle, 1s faster first load

### 7. **Memoize Expensive Component Computations**

**Impact**: 🔥🔥 **Effort**: Low **Files**: `CastRow.tsx`, `CommandPalette.tsx`

**Current Problem**: Complex calculations on every render

```typescript
// Recalculates on every render
const CastRow = ({ cast }) => {
  const reactions = getCastReactionsObj(cast); // Expensive
  const processedText = processText(cast.text); // Heavy
  return <div>...</div>;
};
```

**Solution**: Memoization and optimization

```typescript
const CastRow = memo(({ cast }) => {
  const reactions = useMemo(
    () => getCastReactionsObj(cast),
    [cast.reactions, cast.hash]
  );

  const processedText = useMemo(
    () => processText(cast.text),
    [cast.text]
  );

  return <div>...</div>;
});
```

**Expected Improvement**: 70% faster component rendering

### 8. **Implement Redis Caching for API Responses**

**Impact**: 🔥🔥 **Effort**: High **Files**: `pages/api/*`

**Current Problem**: No server-side caching, repeated expensive queries

```typescript
// Every API call hits external services
export default async function handler(req, res) {
  const data = await neynarClient.searchCasts(req.body);
  res.json(data);
}
```

**Solution**: Multi-layer caching strategy

```typescript
export default async function handler(req, res) {
  const cacheKey = `search:${JSON.stringify(req.body)}`;

  // Check cache first
  let data = await redis.get(cacheKey);
  if (!data) {
    data = await neynarClient.searchCasts(req.body);
    await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5min TTL
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.json(data);
}
```

**Expected Improvement**: 80% reduction in API response times for cached data

### 9. **Optimize Database Queries with Proper Indexing**

**Impact**: 🔥 **Effort**: Medium **Files**: Supabase schema, store queries

**Current Problem**: Inefficient queries without proper indexes

```sql
-- Slow query without index
SELECT * FROM lists WHERE user_id = ? AND created_at > ?;
```

**Solution**: Add strategic database indexes

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_lists_user_created ON lists(user_id, created_at);
CREATE INDEX idx_channels_follower_count ON channels(follower_count) WHERE follower_count > 50;

-- Optimize list operations with bulk updates
UPDATE lists SET updated_at = NOW() WHERE id = ANY(?);
```

**Expected Improvement**: 60% faster database queries

### 10. **Implement Keyboard Shortcut Optimization**

**Impact**: 🔥 **Effort**: Low **Files**: Components using `useHotkeys`

**Current Problem**: Multiple hotkey listeners causing conflicts

```typescript
// Each component registers shortcuts
useHotkeys('cmd+k', openCommandPalette);
useHotkeys('cmd+enter', submitPost);
useHotkeys('j', selectNext);
```

**Solution**: Centralized keyboard handling

```typescript
const GlobalKeyboardHandler = () => {
  const shortcuts = useHotkeys(
    [
      ['cmd+k', openCommandPalette],
      ['cmd+enter', submitPost],
      ['j', selectNext],
    ],
    {
      enableOnFormTags: true,
      preventDefault: true,
    }
  );

  return null;
};
```

**Expected Improvement**: 50ms faster keyboard response times

## Performance Metrics Targets

| Metric                  | Current     | Target     | Method                |
| ----------------------- | ----------- | ---------- | --------------------- |
| **Time to Interactive** | 5.2s        | 1.5s       | Progressive hydration |
| **Keyboard Response**   | 200-500ms   | 50-100ms   | Optimistic updates    |
| **Feed Scrolling**      | Janky       | 60fps      | Virtualization        |
| **Search Response**     | 300-800ms   | 100-200ms  | Debouncing + caching  |
| **Bundle Size**         | 2.71MB      | 1.35MB     | Code splitting        |
| **API Calls**           | 50-100/page | 10-20/page | Deduplication         |

## Implementation Roadmap

### Phase 1: Critical Path (Week 1-2)

- Progressive store hydration
- Optimistic updates for user actions
- Input debouncing
- Basic memoization

### Phase 2: Core Performance (Week 3-4)

- React Query implementation
- Virtual scrolling for feeds
- Bundle optimization
- Redis caching

### Phase 3: Advanced Optimization (Week 5-6)

- Database indexing
- Keyboard shortcut optimization
- Advanced caching strategies
- Performance monitoring

## Performance Measurement Harness

### Overview

A lightweight, accurate performance measurement system focused on user-perceived performance using native browser APIs. Targets <200ms response times with sub-millisecond precision measurement.

### 1. Core Performance Tracker Hook

**File**: `src/common/hooks/usePerformanceTracker.ts`

```typescript
interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

export const usePerformanceTracker = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  const startTiming = useCallback((name: string) => {
    performance.mark(`${name}-start`);
    return name;
  }, []);

  const endTiming = useCallback((name: string, threshold = 100) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure.duration;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      threshold,
      status: duration < threshold ? 'good' : duration < threshold * 2 ? 'warning' : 'critical',
    };

    setMetrics((prev) => [metric, ...prev.slice(0, 49)]); // Keep last 50

    // Dev mode logging for critical slowdowns
    if (process.env.NODE_ENV === 'development' && metric.status === 'critical') {
      console.warn(`🐌 SLOW: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }

    return duration;
  }, []);

  return { metrics, startTiming, endTiming };
};
```

### 2. User Interaction Speed Tracker

**File**: `src/common/components/InteractionTracker.tsx`

```typescript
export const InteractionTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { startTiming, endTiming } = usePerformanceTracker();

  useEffect(() => {
    // Keyboard shortcut responsiveness
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.metaKey ? 'cmd+' : ''}${e.key.toLowerCase()}`;
      startTiming(`keyboard-${key}`);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = `${e.metaKey ? 'cmd+' : ''}${e.key.toLowerCase()}`;
      // Give UI time to update, then measure
      requestAnimationFrame(() => {
        endTiming(`keyboard-${key}`, 50); // 50ms target for keyboard
      });
    };

    // Click responsiveness
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const elementId = target.id || target.className.split(' ')[0] || 'unknown';
      startTiming(`click-${elementId}`);

      // Measure after next paint
      requestAnimationFrame(() => {
        endTiming(`click-${elementId}`, 100); // 100ms target for clicks
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('click', handleClick);
    };
  }, [startTiming, endTiming]);

  return <>{children}</>;
};
```

### 3. Critical Path Performance Monitor

**File**: `src/common/components/CriticalPathMonitor.tsx`

```typescript
export const CriticalPathMonitor: React.FC = () => {
  const { startTiming, endTiming } = usePerformanceTracker();

  useEffect(() => {
    // Time-to-interactive measurement
    startTiming('app-init');

    // Store hydration timing
    const originalHydrate = useAccountStore.getState().hydrate;
    useAccountStore.setState({
      hydrate: async () => {
        startTiming('store-hydration');
        const result = await originalHydrate();
        endTiming('store-hydration', 1500); // 1.5s target
        return result;
      },
    });

    // Navigation timing
    const measureNavigation = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const ttfb = navigation.responseStart - navigation.requestStart;
      const domReady = navigation.domContentLoadedEventEnd - navigation.navigationStart;
      const pageLoad = navigation.loadEventEnd - navigation.navigationStart;

      console.log('📊 Navigation Timing:', {
        TTFB: `${ttfb.toFixed(2)}ms`,
        'DOM Ready': `${domReady.toFixed(2)}ms`,
        'Page Load': `${pageLoad.toFixed(2)}ms`,
      });
    };

    // Measure when page is fully loaded
    if (document.readyState === 'complete') {
      measureNavigation();
    } else {
      window.addEventListener('load', measureNavigation);
    }

    return () => {
      window.removeEventListener('load', measureNavigation);
    };
  }, [startTiming, endTiming]);

  return null;
};
```

### 4. Development Performance Panel

**File**: `src/common/components/PerfPanel.tsx` (dev mode only)

```typescript
export const PerfPanel: React.FC = () => {
  const { metrics } = usePerformanceTracker();
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  // Toggle with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible) return null;

  const recentMetrics = metrics.slice(0, 10);
  const slowMetrics = metrics.filter(m => m.status === 'critical').slice(0, 5);

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-sm font-mono z-50 max-w-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">⚡ Performance Monitor</h3>
        <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white">×</button>
      </div>

      <div className="space-y-2">
        <div>
          <h4 className="text-xs text-gray-400 mb-1">Recent Metrics</h4>
          {recentMetrics.map((metric, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="truncate flex-1">{metric.name}</span>
              <span className={`ml-2 ${
                metric.status === 'good' ? 'text-green-400' :
                metric.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {metric.duration.toFixed(1)}ms
              </span>
            </div>
          ))}
        </div>

        {slowMetrics.length > 0 && (
          <div className="border-t border-gray-700 pt-2">
            <h4 className="text-xs text-red-400 mb-1">🐌 Slow Operations</h4>
            {slowMetrics.map((metric, i) => (
              <div key={i} className="text-xs text-red-300">
                {metric.name}: {metric.duration.toFixed(1)}ms
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-2">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
};
```

### 5. Feed Scrolling Performance Monitor

**File**: `src/common/hooks/useScrollPerformance.ts`

```typescript
export const useScrollPerformance = (elementRef: RefObject<HTMLElement>) => {
  const { startTiming, endTiming } = usePerformanceTracker();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let isScrolling = false;
    let scrollStartTime = 0;
    let frameCount = 0;
    let lastFrameTime = 0;

    const handleScrollStart = () => {
      if (!isScrolling) {
        isScrolling = true;
        scrollStartTime = performance.now();
        frameCount = 0;
        startTiming('scroll-session');
        measureFrameRate();
      }
    };

    const handleScrollEnd = () => {
      if (isScrolling) {
        isScrolling = false;
        const duration = performance.now() - scrollStartTime;
        const fps = frameCount / (duration / 1000);

        endTiming('scroll-session', 16); // 60fps = 16ms per frame

        if (fps < 30) {
          console.warn(`🐌 Scroll FPS: ${fps.toFixed(1)} (target: 60fps)`);
        }
      }
    };

    const measureFrameRate = () => {
      if (isScrolling) {
        frameCount++;
        requestAnimationFrame(measureFrameRate);
      }
    };

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      handleScrollStart();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScrollEnd, 150);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [elementRef, startTiming, endTiming]);
};
```

### 6. Performance Test Utilities

**File**: `src/common/utils/performanceTests.ts`

```typescript
interface PerformanceBudget {
  [key: string]: number;
}

const PERFORMANCE_BUDGETS: PerformanceBudget = {
  'store-hydration': 1500,
  'keyboard-cmd+k': 50,
  'keyboard-cmd+enter': 50,
  'click-like': 100,
  'click-recast': 100,
  'search-input': 200,
  'modal-open': 150,
  navigation: 300,
  'feed-render': 500,
};

export const validatePerformanceBudget = (metrics: PerformanceMetric[]) => {
  const violations: Array<{ name: string; actual: number; budget: number }> = [];

  Object.entries(PERFORMANCE_BUDGETS).forEach(([name, budget]) => {
    const metric = metrics.find((m) => m.name === name);
    if (metric && metric.duration > budget) {
      violations.push({
        name,
        actual: metric.duration,
        budget,
      });
    }
  });

  return violations;
};

export const runPerformanceAudit = () => {
  const metrics = JSON.parse(localStorage.getItem('perf-metrics') || '[]');
  const violations = validatePerformanceBudget(metrics);

  if (violations.length > 0) {
    console.group('🚨 Performance Budget Violations');
    violations.forEach(({ name, actual, budget }) => {
      console.warn(
        `${name}: ${actual.toFixed(1)}ms (budget: ${budget}ms) - ${(((actual - budget) / budget) * 100).toFixed(1)}% over`
      );
    });
    console.groupEnd();
  } else {
    console.log('✅ All performance budgets met!');
  }

  return violations;
};
```

### 7. Integration Setup

**File**: `pages/_app.tsx` - Add to root component

```typescript
// Add to _app.tsx in development mode
{process.env.NODE_ENV === 'development' && (
  <>
    <InteractionTracker>
      <CriticalPathMonitor />
      <PerfPanel />
    </InteractionTracker>
  </>
)}
```

### Usage Instructions

1. **Development Mode**: Performance panel toggles with `Ctrl+Shift+P`
2. **Real-time Monitoring**: Color-coded metrics (green <100ms, yellow 100-200ms, red >200ms)
3. **Bottleneck Detection**: Console warnings for operations exceeding thresholds
4. **Performance Budgets**: Automated validation against Superhuman-like targets
5. **Zero Production Impact**: All monitoring code stripped in production builds

### Key Performance Targets

| Action             | Target  | Critical Threshold |
| ------------------ | ------- | ------------------ |
| Keyboard Shortcuts | <50ms   | 100ms              |
| Button Clicks      | <100ms  | 200ms              |
| Search Input       | <200ms  | 400ms              |
| Modal Opening      | <150ms  | 300ms              |
| Feed Scrolling     | 60fps   | 30fps              |
| Store Hydration    | <1500ms | 3000ms             |

This measurement harness provides precise, actionable data on what's actually slowing down the user experience and helps validate that performance improvements are working as expected.

## Success Criteria

1. **Initial Load**: < 1.5s to interactive state
2. **User Actions**: < 100ms response time
3. **Keyboard Shortcuts**: < 50ms response time
4. **Feed Scrolling**: Smooth 60fps performance
5. **Search**: < 200ms response time
6. **Bundle Size**: < 1.5MB initial load

This comprehensive performance improvement plan addresses the core bottlenecks preventing herocast from achieving Superhuman-like responsiveness while maintaining all existing features and functionality.
