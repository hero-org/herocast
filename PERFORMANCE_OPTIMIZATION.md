# Performance Optimization Session

**Started:** 2026-01-27
**Status:** In Progress

---

## Executive Summary

The herocast app has significant performance issues primarily caused by:
1. **Massive bundle sizes** - Most routes load 1.6-2.0 MB of JS
2. **Unused dependencies** - Recharts (590KB) never used ✅ FIXED
3. **Over-eager wallet loading** - 2MB viem/wagmi on every route (only needed on 2-3 pages)
4. **Performance anti-patterns** - Missing memoization, inline functions, unoptimized images

**Potential savings:** 600KB-1MB per route (30-50% reduction)

---

## Benchmark Results

### Latest Benchmark (2026-01-27 13:21)

#### Local Development
| Route | Load Time | DOM Ready | Notes |
|-------|-----------|-----------|-------|
| `/login` | **581ms** | 74ms | Optimized today |
| `/feeds` | **2,625ms** | 1,668ms | First load 5.8s, cached 1s |

#### Production (app.herocast.xyz)
| Route | Load Time | FCP | Notes |
|-------|-----------|-----|-------|
| `/login` | **1,317ms** | 683ms | Good |
| `/feeds` | **1,200ms** | 380ms | Acceptable |

### Historical Comparison
| Route | Before Optimization | After | Improvement |
|-------|---------------------|-------|-------------|
| `/login` | 16,312ms | 581ms | **96% faster** |

---

## Bundle Size Analysis

### Critical Issues

#### 1. ✅ FIXED: UNUSED RECHARTS
**File:** `src/components/ui/chart.tsx` - DELETED
- Recharts library imported but NEVER used anywhere
- **Action:** Removed entire file and dependency
- **Status:** Complete

#### 2. WALLET LIBRARIES ON ALL ROUTES - 2MB
**File:** `app/WalletProviders.tsx`
- viem/wagmi loaded on every route
- Only actually needed on: `/accounts`, `/welcome/connect`
- **Action:** Route-level lazy loading (NOT YET DONE)
- **Impact:** -2MB on most routes

#### 3. ✅ PARTIALLY FIXED: LODASH FRAGMENTATION
- `lodash.includes` - REMOVED (replaced with native `.includes()`)
- Remaining: `lodash.isempty`, `lodash.uniqby`, `lodash.get`, `lodash.sortby`, etc.
- **Action:** Continue replacing with native JS

### Route Bundle Sizes (First Load JS) - Post-Optimization

| Route | Size | Priority | Change |
|-------|------|----------|--------|
| `/post` | **2.01 MB** | CRITICAL | - |
| `/workspace` | 1.83 MB | HIGH | -0.01 MB |
| `/inbox` | 1.82 MB | HIGH | - |
| `/search` | 1.82 MB | HIGH | - |
| `/welcome/connect` | 1.81 MB | HIGH | - |
| `/feeds` | 1.79 MB | HIGH | - |
| `/dms` | 1.71 MB | HIGH | - |
| `/settings` | 1.69 MB | HIGH | - |
| `/list` | 1.67 MB | HIGH | - |
| `/login` | 1.67 MB | HIGH | - |
| `/channels` | 1.62 MB | MEDIUM | - |
| `/lists` | 1.60 MB | MEDIUM | - |
| `/profile` | 1.57 MB | MEDIUM | -0.01 MB |

---

## Identified Performance Anti-Patterns

### Images (3 locations)
- `src/common/components/PostEmbeddedContent/ImageEmbed.tsx:40` - Uses `<img>` not next/image
- `src/common/components/Sidebar/AccountsOverview.tsx:68` - Missing width/height
- `src/common/components/RecommendedProfilesCard.tsx:75` - No optimization

### Missing Memoization (5+ locations)
- `DirectMessages/MessageThread.tsx:61-84` - `groupMessagesByUser()` not memoized
- `DirectMessages/MessageThread.tsx:78-82` - `sortedMessages` recreated every render
- `CastRow.tsx:550-621` - `renderCastReactions()` expensive

### Inline Functions in JSX (10+ locations)
- `CastRow.tsx:895-902, 954-960, 975-977`
- `Sidebar/ChannelsOverview.tsx:49`
- `CompactSearchFilters.tsx:53, 59, 65, 73, 80, 87`

### ✅ FIXED: Components Missing React.memo
- ~~`ProfileHoverCard.tsx`~~ - Now memoized
- ~~`DirectMessages/ConversationListItem.tsx`~~ - Now memoized
- `Sidebar/CollapsibleList.tsx` - Still not memoized

---

## Completed Optimizations

### 1. Login Page Optimization (2026-01-27)
- **Before:** 16.3s load time
- **After:** 581ms load time
- **Improvement:** 96%
- **Changes:**
  - Removed unused AuthKit code
  - Removed hero image
  - Redesigned to match shadcn patterns
  - Added loading.tsx skeleton

### 2. Dependency Cleanup (2026-01-27)
- **Removed:** recharts library and `src/components/ui/chart.tsx`
- **Removed:** lodash.includes (6 files updated to native JS)
- **Changed:** ReactQueryDevtools to lazy-load only in development

### 3. Component Memoization (2026-01-27)
- Added `React.memo` to `ConversationListItem`
- Added `React.memo` to `ProfileHoverCard`

---

## In Progress

_Nothing currently in progress_

---

## Proposed Changes (NOT YET IMPLEMENTED)

### Large Refactors

#### 1. Route-Based Provider Architecture (HIGH IMPACT)
Instead of loading all providers at app level, load per-route:
```tsx
// Current: app/providers.tsx loads everything
// Proposed: Each route group loads only what it needs

// app/(wallet)/layout.tsx - Only for wallet-needing routes
export default function WalletLayout({ children }) {
  return <WalletProviders>{children}</WalletProviders>
}

// app/(app)/layout.tsx - Standard routes without wallet
export default function AppLayout({ children }) {
  return <>{children}</>
}
```
**Impact:** Could reduce most route bundles by ~2MB

#### 2. Lazy-Load Heavy Components
```tsx
// Current: @tiptap loaded immediately
// Proposed: Load when user opens compose
const Editor = dynamic(() => import('@/components/Editor'), {
  loading: () => <EditorSkeleton />
})
```

#### 3. Image Optimization Strategy
- Replace all `<img>` with `next/image`
- Add blur placeholders for profile images
- Implement responsive image sizes

### System Changes

#### 1. Add Bundle Analyzer
```js
// next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
```

#### 2. Implement Route-Level Code Splitting
Group routes by dependency requirements:
- **Wallet routes:** `/accounts`, `/welcome/connect`
- **Editor routes:** `/post`
- **Standard routes:** Everything else

---

## Ideas & Design Challenges

### Feed Performance
- Consider virtualization improvements
- Prefetch next page on scroll
- Cache images more aggressively

### Perceived Performance
- Add skeleton loading for cast rows
- Optimistic UI updates for reactions
- Preload profile data on hover

### Mobile Performance
- Reduce initial payload for mobile
- Lazy load images below fold
- Consider service worker caching

---

## TODO

### Immediate (This Session)
- [x] Run benchmarks (local + prod)
- [x] Analyze bundle sizes
- [x] Identify performance anti-patterns
- [x] Remove recharts dependency
- [x] Make DevTools dev-only
- [x] Replace lodash.includes with native JS (6 files)
- [x] Add React.memo to ConversationListItem
- [x] Add React.memo to ProfileHoverCard

### Follow-up (Future Sessions)
- [ ] **HIGH PRIORITY:** Implement route-level wallet loading (-2MB on most routes)
- [ ] Add bundle analyzer to CI
- [ ] Replace remaining lodash imports (isEmpty, get, sortBy, etc.)
- [ ] Standardize on next/image for all images
- [ ] Add memoization to MessageThread
- [ ] Add React.memo to CollapsibleList
- [ ] Lazy-load @tiptap editor

---

## Session Log

### 2026-01-27 11:45
- Started optimization session
- User granted permissions: UI changes OK, well-known libs only, can create components, can optimize APIs

### 2026-01-27 13:21
- Ran local benchmark: login 581ms, feeds 2.6s
- Ran prod benchmark: login 1.3s, feeds 1.2s
- Bundle analysis complete: recharts unused (590KB), wallet libs 2MB on all routes
- Performance anti-patterns identified: 10+ inline functions, 5+ missing memoization, 3 unoptimized images

### 2026-01-27 13:25
- Started quick wins implementation

### 2026-01-27 13:45
- Completed quick wins:
  - Removed recharts dependency and chart.tsx
  - Made ReactQueryDevtools lazy-load in dev only
  - Replaced lodash.includes with native .includes() in 6 files
  - Added React.memo to ConversationListItem and ProfileHoverCard
- Build verified successful
- Bundle sizes: minimal visible change (tree-shaking was already working)
- Real benefit: cleaner codebase, faster installs, proper memoization

### 2026-01-27 14:30 - Faker.js Investigation & Fix ✅
- Ran bundle analyzer (`ANALYZE=true pnpm build`)
- **CRITICAL FINDING:** @faker-js/faker is 7.9 MB in production bundle
- Investigation revealed:
  - @farcaster/core lists faker as a **production dependency** (not dev)
  - GitHub issue #2031 specifically mentions herocast
  - PR #2201 (Oct 2024) moved faker FROM devDeps TO deps (making it worse)
  - Farcaster uses faker in factory.ts for test utilities but ships it as prod dep
- **Attempted fix 1:** pnpm override to faker v9 - FAILED (v9 has breaking API changes)
- **Attempted fix 2:** Webpack alias to stub that throws errors - FAILED (factories evaluated at build time)
- **Successful fix:** Webpack alias to stub with dummy return values
  - Created `src/lib/faker-stub.ts` - returns safe dummy values
  - Added webpack alias in `next.config.mjs` to redirect `@faker-js/faker` imports
  - herocast doesn't use Factory functions, so dummy values are safe

**Results:**
| Route | Before | After | Reduction |
|-------|--------|-------|-----------|
| `/login` | 1.67 MB | 745 KB | **55%** |
| `/feeds` | 1.79 MB | 865 KB | **52%** |
| `/post` | 2.01 MB | 1.08 MB | **46%** |
| `/inbox` | 1.82 MB | 892 KB | **51%** |

### Next Steps
The remaining opportunity:
1. **Route-level wallet loading (~2MB)** - viem/wagmi loaded on every route but only needed on 2-3 pages. Requires provider architecture refactor.

