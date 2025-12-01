# React Query Migration Plan - Issue #633

## Progress Summary

| Phase    | Status      | Description                                  |
| -------- | ----------- | -------------------------------------------- |
| Phase 1  | ✅ Complete | Core infrastructure + TRENDING feed          |
| Phase 2a | ✅ Complete | FOLLOWING + Channel feeds                    |
| Phase 2b | ✅ Complete | Profile page + components                    |
| Phase 3  | 🔲 Pending  | Store integration (useDataStore replacement) |

---

## Phase 1: Core Infrastructure ✅ COMPLETE

### Implemented

1. **QueryClient Configuration** (`src/lib/queryClient.ts`)

   - 5-min staleTime matching existing TTL
   - 30-min garbage collection
   - Retry with exponential backoff
   - Window focus/reconnect refetching

2. **Query Keys Factory** (`src/lib/queryKeys.ts`)

   - Type-safe query keys for feeds, profiles, casts, search, notifications, analytics, channels
   - Hierarchical structure for granular cache invalidation

3. **React Query DevTools** (`app/providers.tsx`)

   - Development-only debugging tools
   - Cache visualization

4. **TRENDING Feed Hook** (`src/hooks/queries/useTrendingFeed.ts`)
   - `useTrendingFeed()` - Single page
   - `useTrendingFeedInfinite()` - Infinite scroll
   - `flattenTrendingFeedPages()` - Helper

---

## Phase 2a: Feed Page Migration ✅ COMPLETE

### Implemented

1. **FOLLOWING Feed Hook** (`src/hooks/queries/useFollowingFeed.ts`)

   - `useFollowingFeed(fid)` - Single page
   - `useFollowingFeedInfinite(fid)` - Infinite scroll
   - Takes FID as parameter for flexibility

2. **Channel Feed Hook** (`src/hooks/queries/useChannelFeed.ts`)

   - `useChannelFeed(parentUrl, fid)` - Single page
   - `useChannelFeedInfinite(parentUrl, fid)` - Infinite scroll

3. **Feeds Page Integration** (`app/(app)/feeds/page.tsx`)
   - TRENDING, FOLLOWING, Channel feeds use React Query
   - FID lists and search lists use existing fetch pattern
   - Fixed `/api/lists` to pass FIDs directly (avoids App Router auth issues)

---

## Phase 2b: Profile Migration ✅ COMPLETE

### Implemented

1. **Single Profile Hook** (`src/hooks/queries/useProfile.ts`)

   - `useProfileByFid(fid, options)` - Fetch by FID
   - `useProfileByUsername(username, options)` - Fetch by username
   - `useProfile({ fid?, username? }, options)` - Hybrid lookup
   - Supports `includeAdditionalInfo` for Icebreaker/Coordinape data

2. **Bulk Profiles Hook** (`src/hooks/queries/useBulkProfiles.ts`)

   - `useBulkProfiles(fids[], options)` - Batch fetch with 100-FID batching
   - `useProfiles(fids[], options)` - Individual queries for granular caching
   - `getProfileFromBulk()` - Helper to extract profile by FID

3. **Profile Feed Hook** (`src/hooks/queries/useProfileFeed.ts`)

   - `useUserCasts(fid)` - User's authored casts
   - `useUserLikes(fid)` - User's liked casts
   - `useProfileFeed(fid, 'casts' | 'likes')` - Combined hook
   - Infinite scroll variants available

4. **Components Updated**
   - `app/(app)/profile/[slug]/page.tsx` - Uses `useProfile` + `useProfileFeed`
   - `src/common/components/ProfileInfo.tsx` - Uses `useProfileByFid`
   - `src/common/components/ProfileHoverCard.tsx` - Uses `useProfile` with `enabled: inView`

### Benefits Achieved

- **Request deduplication**: Same profile fetched once across components
- **Automatic caching**: 5-min staleTime, no manual `shouldUpdateProfile()` checks
- **Lazy loading**: ProfileHoverCard only fetches when visible
- **Loading/error states**: Built-in, no manual tracking needed

---

## Phase 3: Store Integration (PENDING)

### Strategy

Replace `useDataStore` profile caching with React Query entirely.

### Components Still Using useDataStore

- `src/stores/useDataStore.ts` - `fidToData`, `usernameToFid` maps
- `src/common/helpers/profileUtils.ts` - `fetchAndAddUserProfile()`, `getProfile()`
- Various components that import from profileUtils

### Migration Steps

1. Identify all components using `useDataStore` for profiles
2. Replace with `useProfile` or `useBulkProfiles` hooks
3. Remove `fidToData` and `usernameToFid` from useDataStore
4. Deprecate `profileUtils.ts` functions
5. Keep useDataStore for non-profile data (tokens, selected cast, etc.)

---

## Files Changed Summary

### New Files

| File                                    | Purpose                     |
| --------------------------------------- | --------------------------- |
| `src/lib/queryClient.ts`                | QueryClient configuration   |
| `src/lib/queryKeys.ts`                  | Type-safe query key factory |
| `src/hooks/queries/useTrendingFeed.ts`  | TRENDING feed hooks         |
| `src/hooks/queries/useFollowingFeed.ts` | FOLLOWING feed hooks        |
| `src/hooks/queries/useChannelFeed.ts`   | Channel feed hooks          |
| `src/hooks/queries/useProfile.ts`       | Single profile hooks        |
| `src/hooks/queries/useBulkProfiles.ts`  | Bulk profile hooks          |
| `src/hooks/queries/useProfileFeed.ts`   | User casts/likes hooks      |

### Modified Files

| File                                         | Changes                                |
| -------------------------------------------- | -------------------------------------- |
| `app/providers.tsx`                          | Added DevTools, configured QueryClient |
| `app/(app)/feeds/page.tsx`                   | Integrated feed hooks                  |
| `app/(app)/profile/[slug]/page.tsx`          | Uses profile + feed hooks              |
| `src/common/components/ProfileInfo.tsx`      | Uses `useProfileByFid`                 |
| `src/common/components/ProfileHoverCard.tsx` | Uses `useProfile` with lazy loading    |
| `app/api/lists/route.ts`                     | Accepts FIDs directly, uses Neynar API |

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

---

## Next Steps

1. **Test thoroughly**: Verify all feed types and profile components work
2. **Phase 3**: Begin useDataStore profile cache replacement
3. **DMs page**: Migrate to React Query (complex real-time needs)
4. **Cleanup**: Remove unused profileUtils functions after full migration
