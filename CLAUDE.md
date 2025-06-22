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

## Deployment

- Vercel for web deployment
- Sentry integration for error monitoring
- PostHog for analytics
- Tauri for desktop app distribution
