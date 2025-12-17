# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
