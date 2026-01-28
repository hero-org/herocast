# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference for Common Tasks

| Task | Key Files |
|------|-----------|
| Add new feed type | `src/hooks/queries/use*Feed.ts`, `app/api/feeds/*/route.ts` |
| Add UI component | `src/components/ui/` (shadcn), `src/common/components/` (app-specific) |
| Add new page | `app/(app)/[route]/page.tsx`, add `loading.tsx` |
| Modify store | `src/stores/use*Store.ts` |
| Add API route | `app/api/[route]/route.ts` |
| Add perf tracking | Use `fetchWithPerf` or `measureAsync` from `@/stores/usePerformanceStore` |
| Fix layout issues | Check for missing `min-h-0` and `flex-1` (see Layout Architecture) |

## Project Overview

herocast is an open source Farcaster client built with Next.js, focused on professional users and power features. The application supports multi-account management, advanced content creation, analytics, and both web and desktop (Tauri) platforms.

## Common Development Commands

### Development

- `pnpm run dev` - Start Next.js development server
- `pnpm run build` - Build production Next.js application
- `pnpm run start` - Start production server

### Code Quality

- `pnpm run lint` - Run ESLint (extends Next.js config)
- `pnpm run lint:fix` - Auto-fix ESLint issues
- `pnpm run format` - Format code with Prettier
- `pnpm test` - Run Jest tests

### Desktop App (Tauri)

- `pnpm run rls` - Build production Tauri app
- `pnpm run rls:debug` - Build debug Tauri app
- `pnpm run rls:mac-universal` - Build universal macOS binary

## Architecture Overview

### Technology Stack

- **Frontend**: Next.js 15 with TypeScript, React 18
- **Styling**: Tailwind CSS with Radix UI components and shadcn/ui
- **State Management**: Zustand stores with mutative for immutable updates
- **Data Persistence**:
  - IndexedDB for local storage (accounts, settings)
  - Supabase for server-side data (lists, analytics, billing)
  - SessionStorage for temporary data (drafts)
- **Authentication**: Farcaster auth-kit, Supabase auth, wallet connections
- **Desktop**: Tauri for cross-platform desktop application

### Key Directories

- `src/stores/` - Zustand state management (6 main stores)
- `src/common/components/` - Reusable React components
- `pages/` - Next.js pages and API routes
- `src/common/helpers/` - Utility functions for Farcaster, Supabase, etc.
- `supabase/` - Database schema, functions, and migrations

### State Management Architecture

The application uses 6 main Zustand stores:

1. **useAccountStore** - Multi-account Farcaster management, channels, authentication
2. **useDataStore** - Profile/cast caching, token data (memory only)
3. **useDraftStore** - Post composition, scheduling, publishing
4. **useListStore** - User lists, search history (server-persisted)
5. **useNavigationStore** - Modal states, UI navigation (memory only)
6. **useUserStore** - User profile, billing, subscription data

All stores use mutative for immutable updates and have different persistence strategies based on data sensitivity and usage patterns.

### Farcaster Integration

- Uses @farcaster/core and @neynar/nodejs-sdk for protocol interactions
- Supports multiple Farcaster accounts with automatic key management
- Integrates with Warpcast for enhanced features and embeds
- Handles cast publishing, channel management, and user interactions

### Database Design

- **Supabase**: User accounts, lists, analytics, scheduled posts, billing
- **IndexedDB**: Local account storage, settings, offline capability
- **TypeORM**: Entity definitions in `src/lib/entities/`
- **IDs**: Use `string` for UUIDs (not `import { UUID } from 'crypto'`) - Supabase returns strings over JSON

### Styling Patterns

- Uses Tailwind with custom design system based on Radix colors
- shadcn/ui components in `src/components/ui/`
- Custom fonts (Satoshi) loaded via Next.js localFont
- Theme system with light/dark modes via next-themes

## Development Guidelines

### Code Organization

- Components follow atomic design principles
- Shared utilities in `src/common/helpers/`
- Store actions are async with proper error handling
- API routes follow Next.js conventions in `pages/api/`

### State Management Patterns

- Use mutative draft pattern for all state updates
- Persist critical data to both local and server storage
- Keep sensitive data (private keys) out of persistent storage
- Initialize stores via `initializeStores()` on app startup

### Component Development

- Extend existing shadcn/ui components when possible
- Follow established patterns in `src/common/components/`
- Use TypeScript strictly with proper typing
- Implement proper error boundaries and loading states

### Farcaster Development

- Use existing helpers in `src/common/helpers/farcaster.ts`
- Follow Farcaster protocol specifications for data structures
- Handle multiple account scenarios in all features
- Test with both mainnet and testnet data

## Testing

- Jest configuration in `jest.config.js`
- Test files in `src/common/helpers/__tests__/`
- Focus on utility function testing
- Use `@jest/globals` for test setup

## Common Patterns & Gotchas

### API Routes Pattern
All API routes follow this structure:
```typescript
// app/api/[name]/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // ... validation ...
  // ... call external API (Neynar, Supabase) ...
  return NextResponse.json(data);
}
export const maxDuration = 20; // Vercel timeout
```

### React Query Hooks Pattern
Feed hooks in `src/hooks/queries/`:
```typescript
// Fetch function (internal)
async function fetchXxxFeed(params): Promise<Response> { ... }

// Single page hook
export function useXxxFeed(params, options) { return useQuery(...) }

// Infinite scroll hook
export function useXxxFeedInfinite(params, options) { return useInfiniteQuery(...) }

// Flatten helper
export function flattenXxxFeedPages(data): Cast[] { ... }
```

### Store Pattern
All Zustand stores in `src/stores/`:
```typescript
interface StoreState { /* data */ }
interface StoreActions {
  hydrate: () => Promise<void>;  // Load from storage/API
  // ... mutations ...
}
export const useXxxStore = create<StoreState & StoreActions>((set, get) => ({
  // initial state
  // actions using mutative for immutable updates
}));
```

### Known Issues / Gotchas

1. **Neynar API is slow** (7-8s) - Always show loading states, use caching
2. **Store init runs twice in dev** - React strict mode, ignore the duplicate
3. **IndexedDB async** - Store hydration is async, check `isHydrated` before accessing data
4. **Supabase returns strings** - Use `string` type for UUIDs, not `UUID` from crypto
5. **Flex scroll issues** - Add `min-h-0` to flex children that need to scroll

## Feed Architecture

### Feed Types

The application supports multiple feed types through a unified feed system:

- **Custom Channels**: `CUSTOM_CHANNELS` enum defines special feeds
  - `FOLLOWING` - User's following feed
  - `TRENDING` - Global trending feed
- **Channel Feeds**: User-subscribed Farcaster channels
- **List Feeds**: Custom lists with different content types
  - **Search Lists**: Keyword-based feeds with filters
  - **FID Lists**: Curated lists of specific users
  - **Auto-interaction Lists**: Automated engagement lists

### Feed Implementation

- **Main Feed Component**: `pages/feeds/index.tsx`
  - Manages feed state using `FeedKeyToFeed` mapping
  - Supports pagination with cursor-based loading
  - Handles different feed sources (Neynar API, custom lists, search)
  - Implements auto-refresh on visibility change

### Feed Components

- **CastRow**: Individual cast rendering with interactions
- **CastThreadView**: Threaded conversation view
- **SelectableListWithHotkeys**: Keyboard navigation for feed items
- **Layout Constants**: `src/common/constants/layout.ts` defines spacing values (avatar size, padding, thread line positions) - use these instead of magic numbers when modifying CastRow or CastThreadView

### List System

- **List Types**: Defined in `src/common/types/list.types.ts`
  - `SearchListContent`: Search term + filters
  - `FidListContent`: Array of user FIDs
  - `AutoInteractionListContent`: Automated actions configuration
- **List Store**: `useListStore` manages all list operations
- **List Components**:
  - `ListsOverview`: Sidebar list navigation
  - `SearchListsView`: Search list management
  - `UserListsView`: FID list management

## Layout Architecture

### Home Layout (`src/home/index.tsx`)

The main layout uses a complex flex structure with fixed and flexible elements:

- **SidebarProvider** (`src/components/ui/sidebar.tsx`): Wraps the entire app and is a **flex container** (`flex` class)
- **Left Sidebar**: Fixed positioned (`lg:fixed lg:w-40`), not in document flow
- **Main Content**: Must have `flex-1` to fill remaining space in SidebarProvider's flex container
- **Right Sidebar**: Conditionally rendered, `w-64 flex-shrink-0`

**Critical**: Line 478 in `src/home/index.tsx` MUST have `flex-1`:

```tsx
<div className="h-full lg:ml-40 flex-1">
```

Without `flex-1`, the main content area will only take its content width instead of filling available space, causing the feed to appear "squeezed".

### Virtualization in Feeds

The feed uses `@tanstack/react-virtual` for performance. Key implementation details in `SelectableListWithHotkeys.tsx`:

- Use `top` positioning instead of `transform: translateY()` for virtual items
- `transform` creates a CSS containing block that breaks percentage width calculations
- Item wrapper must have `width: '100%'` and `position: absolute`

### Scroll Containers (Common Issue)

When content doesn't scroll, check for missing `min-h-0` on flex children. This is a **recurring issue** in this codebase.

**The Pattern:**

```tsx
// Parent with fixed height
<div className="h-screen flex flex-col">
  {/* Fixed header */}
  <header className="h-16" />

  {/* Scrollable content - MUST have min-h-0 */}
  <div className="flex-1 min-h-0 overflow-y-auto">{/* Content that needs to scroll */}</div>
</div>
```

**Why `min-h-0` is required:**

- By default, flex children have `min-height: auto`, which prevents them from shrinking below their content size
- This causes `overflow-y-auto` to have no effect because the container grows to fit content
- Adding `min-h-0` allows the flex child to shrink, enabling overflow scrolling

**Quick fix checklist:**

1. Check all parent containers have constrained height (`h-screen`, `h-full`, fixed px)
2. Add `min-h-0` to every flex child between the height-constrained parent and the `overflow-y-auto` element
3. Ensure `flex-1` is present on growing containers

## Deployment

- Vercel for web deployment
- Sentry integration for error monitoring
- PostHog for analytics
- Tauri for desktop app distribution

## Performance Tracking

### Overview

The app includes a performance tracking system that measures operation durations and reports slow operations. Metrics are:
- Logged to console in development (with colored output)
- Sent to PostHog in production (for `warning` and `critical` status only)
- Stored in `usePerformanceStore` for the dev panel

### Key Files

- `src/stores/usePerformanceStore.ts` - Core tracking store and utilities
- `src/common/components/PerfPanel.tsx` - Dev-only performance panel
- `src/lib/fetchWithPerf.ts` - Tracked fetch wrapper for API calls
- `src/common/hooks/useNavigationPerf.ts` - Page navigation tracking

### Using Performance Tracking

**Track an async operation:**
```typescript
import { measureAsync } from '@/stores/usePerformanceStore';

const result = await measureAsync(
  'my-operation',           // metric name
  () => fetchSomething(),   // async function
  500,                      // threshold in ms (default: 100)
  { userId: '123' }         // optional metadata
);
```

**Track API calls with fetchWithPerf:**
```typescript
import { fetchWithPerf } from '@/lib/fetchWithPerf';

const response = await fetchWithPerf(
  '/api/my-endpoint',
  { method: 'POST', body: JSON.stringify(data) },
  { name: 'api:my-endpoint', threshold: 500, metadata: { action: 'create' } }
);
```

**Manual timing (for complex flows):**
```typescript
import { startTiming, endTiming } from '@/stores/usePerformanceStore';

const timingId = startTiming('complex-operation');
// ... do work ...
endTiming(timingId, 1000, { step: 'final' }); // threshold: 1000ms
```

### Accessing Performance Data

| Environment | Method |
|-------------|--------|
| Development | `Ctrl+Shift+P` opens PerfPanel UI |
| Development | `window.__perfSummary()` in browser console |
| Production | Query PostHog for `performance_metric` events |

### Metric Status Levels

- **good**: Duration < threshold
- **warning**: Duration >= threshold and < 2x threshold
- **critical**: Duration >= 2x threshold

Only `warning` and `critical` metrics are sent to PostHog to reduce noise.

### Current Instrumentation

| Category | Metric Name | Threshold | Location |
|----------|-------------|-----------|----------|
| Navigation | `nav:/feeds`, `nav:/profile`, etc. | 300ms | `useNavigationPerf` hook |
| Feed API | `feed:following` | 1000ms | `useFollowingFeed.ts` |
| Feed API | `feed:trending` | 1000ms | `useTrendingFeed.ts` |
| Store Init | `store-init-total` | 4000ms | `initializeStores.ts` |
| Store Init | `store-init-phase1` | 1000ms | `initializeStores.ts` |
| Store Init | `store-init-phase2` | 3000ms | `initializeStores.ts` |

### Adding New Tracking

When adding performance tracking to new operations:

1. **Choose appropriate threshold**: API calls ~500-1000ms, UI operations ~100-300ms
2. **Use descriptive names**: Prefix with category (`api:`, `feed:`, `nav:`, `store:`)
3. **Add relevant metadata**: Include IDs, counts, or flags that help debug slow operations
4. **Document in this table**: Keep the instrumentation table above up to date

## Loading States

### Loading Pattern Components

The app uses consistent loading patterns via `src/common/components/PageSkeleton.tsx`:

```typescript
import { PageSkeleton } from '@/common/components/PageSkeleton';

// Variants: 'feed' | 'profile' | 'settings' | 'list' | 'generic'
<PageSkeleton variant="feed" itemCount={10} />
```

### Route Loading Files

Next.js App Router `loading.tsx` files provide automatic loading states during navigation:

- `app/(app)/feeds/loading.tsx` - Feed skeleton
- `app/(app)/profile/loading.tsx` - Profile skeleton
- `app/(app)/settings/loading.tsx` - Settings skeleton
- `app/(app)/lists/loading.tsx` - List skeleton
- `app/(app)/search/loading.tsx` - Feed skeleton
- `app/(app)/inbox/loading.tsx` - Feed skeleton
- `app/(app)/dms/loading.tsx` - List skeleton
- `app/(app)/channels/loading.tsx` - List skeleton
- `app/(app)/accounts/loading.tsx` - List skeleton

### Spinner Component

For inline loading indicators:

```typescript
import { Spinner } from '@/components/ui/spinner';

<Spinner size="sm" />  // 'sm' | 'md' | 'lg'
```

### Best Practices

1. **Always show loading state**: Never leave users staring at blank screens
2. **Use skeletons for content**: Prefer `PageSkeleton` over spinners for page content
3. **Use spinners for actions**: Buttons, form submissions, modal loading
4. **Match skeleton to content**: Use the appropriate variant that matches the page structure


## Bundle Size Notes

### Lodash Imports
Use individual lodash packages (e.g., `lodash.isempty`, `lodash.get`) - they are tiny (1-2KB each) and already tree-shaken. Avoid importing from the main `lodash` package which pulls the entire library.

### Faker Stub
`@faker-js/faker` is stubbed via webpack alias in `next.config.mjs` because `@farcaster/core` incorrectly lists it as a production dependency. The stub is at `src/lib/faker-stub.ts` - do not remove it or bundle size increases by 7.9MB.
