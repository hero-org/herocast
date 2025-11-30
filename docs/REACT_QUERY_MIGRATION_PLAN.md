# React Query Migration Plan - Issue #633

## Phase 1: Core Infrastructure (Current Focus)

### Objective
Set up React Query with proper configuration and validate with TRENDING feed before migrating other pages.

### Current State Analysis

**What exists:**
- `@tanstack/react-query` v5.76.0 already in package.json
- `QueryClientProvider` in `app/providers.tsx` but with **no configuration** (bare `new QueryClient()`)
- Manual caching in `useDataStore` (5-min TTL for profiles)
- Server-side caching in `/api/casts` (5-min in-memory Map)
- Performance tracking in `usePerformanceStore`

**Problems identified:**
- No request deduplication (same profile fetched multiple times)
- Manual loading/error state management in every component
- No automatic retry logic (except DirectMessages)
- Race conditions when switching feeds rapidly
- Stale data not automatically refreshed

### Phase 1 Implementation Steps

#### Step 1: Configure QueryClient with Defaults
**File:** `src/lib/queryClient.ts` (new)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (match current useDataStore TTL)
      gcTime: 1000 * 60 * 30,   // 30 minutes garbage collection
      retry: 3,                  // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})
```

**Rationale:**
- 5-min staleTime matches existing `PROFILE_UPDATE_INTERVAL`
- Longer gcTime (30-min) prevents re-fetching on navigation
- Exponential backoff retry for resilience
- Window focus refetch aligns with current visibility-based refresh

#### Step 2: Add React Query DevTools
**File:** `app/providers.tsx` (modify)

- Import `ReactQueryDevtools` from `@tanstack/react-query-devtools`
- Add DevTools component in development only
- Position at bottom-right for non-intrusive debugging

#### Step 3: Create Query Keys Factory
**File:** `src/lib/queryKeys.ts` (new)

```typescript
export const queryKeys = {
  feeds: {
    all: ['feeds'] as const,
    trending: (options?: { cursor?: string }) => ['feeds', 'trending', options] as const,
    following: (fid: string, options?: { cursor?: string }) => ['feeds', 'following', fid, options] as const,
    channel: (parentUrl: string, options?: { cursor?: string }) => ['feeds', 'channel', parentUrl, options] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    byFid: (fid: number) => ['profiles', fid] as const,
    bulk: (fids: number[]) => ['profiles', 'bulk', fids.sort().join(',')] as const,
  },
  // ... extensible for Phase 2+
}
```

#### Step 4: Create useTrendingFeed Hook
**File:** `src/hooks/queries/useTrendingFeed.ts` (new)

- Wrap `neynarClient.fetchTrendingFeed()` with `useQuery`
- Support cursor-based pagination with `useInfiniteQuery`
- Enable automatic request deduplication

#### Step 5: Test Integration
- Use React Query DevTools to monitor:
  - Cache hits vs fresh fetches
  - Request deduplication
  - Stale/fresh state transitions
- Compare with current implementation

### Testing Strategy

**Before (current):**
- Open DevTools Network tab
- Navigate to Trending feed
- Count API requests to api.neynar.com
- Switch tabs, return - count additional requests
- Rapid feed switching - count duplicate requests

**After (with React Query):**
- Same navigation pattern
- React Query DevTools shows:
  - "fresh" (green) = cache hit, no request
  - "stale" (yellow) = background refetch
  - "fetching" (blue) = active request
- Expect: Fewer requests, instant cache hits

### Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/queryClient.ts` | Create | Centralized QueryClient config |
| `src/lib/queryKeys.ts` | Create | Type-safe query key factory |
| `src/hooks/queries/useTrendingFeed.ts` | Create | TRENDING feed hook |
| `app/providers.tsx` | Modify | Use configured client, add DevTools |
| `package.json` | Modify | Add @tanstack/react-query-devtools |

### Success Criteria

1. DevTools shows query cache working
2. Duplicate requests eliminated for TRENDING feed
3. Instant data on tab return (within staleTime)
4. Build passes, no TypeScript errors
5. Existing functionality unchanged

---

## Phase 2: Page Migration (Future)

### Priority Order
1. **Feed page** - Highest impact, most complex
2. **Profile page** - Medium complexity
3. **Analytics page** - Has known race conditions
4. **DMs page** - Real-time updates needed

### Migration Pattern
For each page:
1. Create query hooks in `src/hooks/queries/`
2. Create mutation hooks in `src/hooks/mutations/` (for actions)
3. Replace manual state with `useQuery`/`useInfiniteQuery`
4. Remove redundant loading/error state
5. Test with DevTools

---

## Phase 3: Store Integration (Future)

### Strategy
- **Replace useDataStore cache** with React Query (per your preference)
- Keep stores for:
  - Derived/computed state
  - UI state (selected items, modals)
  - Persisted data (IndexedDB)
- Integrate optimistic updates via mutations

### Files to Eventually Migrate
- `src/stores/useDataStore.ts` - Profile caching → React Query
- `src/stores/useListStore.ts` - List fetching → React Query
- `src/stores/useNotificationStore.ts` - Notification fetching → React Query

---

## Hosting Considerations

**Avoided Vercel-specific features:**
- No Vercel KV
- No Edge Config
- No Vercel-specific caching headers
- Standard Next.js `cache` options work on any Node.js host

**Self-hosting compatible:**
- In-memory QueryClient (no external cache dependencies)
- Standard fetch with retry logic
- Works with Docker, bare-metal, any PaaS
