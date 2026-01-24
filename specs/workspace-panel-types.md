# Workspace Panel Types Spec

> **Prerequisite**: `workspace-infrastructure.md` must be implemented first. This spec adds panel types to the existing workspace system.

## Problem

The workspace infrastructure supports panels, but only has a basic Trending feed panel. Users need the full range of content types: all feed variants, inbox tabs, and DMs.

## Success Criteria

1. All panel types render correctly in workspace
2. Each panel type has appropriate header title and icon
3. Panel-specific interactions work (reply, like, etc.)
4. Add Panel modal shows all available options organized by category

## Scope

### In Scope

**Feed Panels:**

- Following feed
- Trending feed (already exists from infrastructure)
- Channel feed (any pinned channel)
- Search List feed
- FID List feed

**Inbox Panels:**

- Replies
- Mentions
- Likes
- Recasts
- Follows

**DM Panel:**

- Conversation list + selected thread view

### Out of Scope

- Mini Apps panels (not ready)
- Analytics panels (not ready)
- Search panel (may add later)
- Profile panel (may add later)

## Technical Approach

### Panel Type Registry

```typescript
// Extend from infrastructure
type PanelType = 'feed' | 'inbox' | 'dms';

// Feed variants
interface FeedPanelConfig {
  feedType: 'following' | 'trending' | 'channel' | 'search-list' | 'fid-list';
  channelUrl?: string; // For channel feeds
  listId?: string; // For list feeds
}

// Inbox variants
interface InboxPanelConfig {
  tab: 'replies' | 'mentions' | 'likes' | 'recasts' | 'follows';
}

// DMs
interface DMPanelConfig {
  conversationId?: string; // Optional pre-selected conversation
}
```

### Files to Create/Modify

**New Panel Components:**

```
src/common/components/Workspace/panels/
├── FeedPanel.tsx        # Extend to support all feed types
├── InboxPanel.tsx       # New - inbox tab content
└── DMPanel.tsx          # New - DM list + thread
```

**Modify:**

```
src/common/components/Workspace/PanelContent.tsx  # Route to new panels
src/common/components/Workspace/AddPanelModal.tsx # Add all options
src/common/components/Workspace/PanelHeader.tsx   # Dynamic titles/icons
```

### Panel Implementations

#### FeedPanel (extend existing)

Extract shared logic from `app/(app)/feeds/page.tsx`:

- Use appropriate React Query hook based on `feedType`
- `useTrendingFeedInfinite` for trending
- `useFollowingFeedInfinite` for following
- `useChannelFeedInfinite` for channels
- `useSearchListFeedInfinite` for search lists
- `useFidListFeedInfinite` for FID lists

```typescript
function FeedPanel({ config }: { config: FeedPanelConfig }) {
  // Select hook based on feedType
  const feedHook = useFeedHook(config);

  return (
    <SelectableListWithHotkeys
      data={feedHook.data}
      renderRow={(cast) => <CastRow cast={cast} />}
      // ... simplified - no thread view in panel
    />
  );
}
```

#### InboxPanel (new)

Extract from `app/(app)/inbox/page.tsx`:

- Single tab view (no tab switcher - the panel IS the tab)
- Use existing notification fetching logic
- Render notification rows

```typescript
function InboxPanel({ config }: { config: InboxPanelConfig }) {
  const { tab } = config;
  // Reuse notification fetching logic from inbox page
  // Render notification list for this specific tab
}
```

#### DMPanel (new)

Extract from `app/(app)/dms/page.tsx`:

- Two-column layout: conversation list + message thread
- Or single-column with back navigation if panel is narrow

```typescript
function DMPanel({ config }: { config: DMPanelConfig }) {
  // Reuse DM logic from dms page
  // Responsive: 2-col if wide enough, 1-col if narrow
}
```

### Add Panel Modal Categories

```
┌─────────────────────────────────────┐
│         Add Panel                   │
├─────────────────────────────────────┤
│ FEEDS                               │
│   ○ Following                       │
│   ○ Trending                        │
│   ○ Channel... (opens picker)       │
│   ○ List... (opens picker)          │
├─────────────────────────────────────┤
│ INBOX                               │
│   ○ Replies                         │
│   ○ Mentions                        │
│   ○ Likes                           │
│   ○ Recasts                         │
│   ○ Follows                         │
├─────────────────────────────────────┤
│ MESSAGES                            │
│   ○ DMs                             │
└─────────────────────────────────────┘
```

### Panel Headers

Each panel type gets appropriate title and icon:

| Type             | Title          | Icon                 |
| ---------------- | -------------- | -------------------- |
| feed:following   | Following      | Home                 |
| feed:trending    | Trending       | TrendingUp           |
| feed:channel     | {Channel Name} | Hash or channel icon |
| feed:search-list | {List Name}    | Search               |
| feed:fid-list    | {List Name}    | Users                |
| inbox:replies    | Replies        | MessageCircle        |
| inbox:mentions   | Mentions       | AtSign               |
| inbox:likes      | Likes          | Heart                |
| inbox:recasts    | Recasts        | Repeat               |
| inbox:follows    | Follows        | UserPlus             |
| dms              | Messages       | MessageSquare        |

### Existing Code to Leverage

**For Feeds:**

- `src/hooks/queries/useTrendingFeed.ts`
- `src/hooks/queries/useFollowingFeed.ts`
- `src/hooks/queries/useChannelFeed.ts`
- `src/hooks/queries/useSearchListFeed.ts`
- `src/hooks/queries/useFidListFeed.ts`
- `src/common/components/CastRow.tsx`
- `src/common/components/SelectableListWithHotkeys.tsx`

**For Inbox:**

- `app/(app)/inbox/page.tsx` - notification fetching, rendering logic
- Notification type enums and helpers

**For DMs:**

- `app/(app)/dms/page.tsx` - DM logic
- `src/common/components/DirectMessages/` - existing DM components

## Edge Cases

- **Channel/List deleted**: Show "Content not found" with remove panel option
- **No notifications**: Show empty state per tab
- **No DM conversations**: Show "No messages yet" empty state
- **Narrow DM panel**: Switch to single-column with back button
- **Feed fails to load**: Panel error boundary catches, shows retry

## Definition of Done

- [x] Following feed panel works
- [x] Channel feed panel works (with channel picker)
- [x] Search List feed panel works (with list picker)
- [x] FID List feed panel works (with list picker)
- [x] Replies inbox panel works
- [x] Mentions inbox panel works
- [x] Likes inbox panel works
- [x] Recasts inbox panel works
- [x] Follows inbox panel works
- [ ] DM panel works (list + thread) - **SKIPPED** (needs design thinking)
- [x] Add Panel modal shows all options organized
- [x] Panel headers show correct titles and icons
- [x] Interactions (reply, like) work from panels

---

## Implementation Status (2026-01-22)

### Completed

**Files Created:**

- `src/common/components/Workspace/panels/FeedPanel.tsx` - Extended with all feed types
- `src/common/components/Workspace/panels/InboxPanel.tsx` - New inbox panel component
- `src/common/components/Workspace/AddPanelPlaceholder.tsx` - Grid with channel/list pickers
- `src/common/components/Workspace/PanelContent.tsx` - Routes feed and inbox panels
- `src/common/components/Workspace/WorkspaceLayout.tsx` - Titles/icons for all types
- `src/common/types/workspace.types.ts` - Extended with InboxPanelConfig

**React Query Hooks Used:**

- `useTrendingFeedInfinite` - Trending feed
- `useFollowingFeedInfinite` - Following feed
- `useChannelFeedInfinite` - Channel feed
- `useFidListFeedInfinite` - FID list feed
- `useSearchListFeedInfinite` - Search list feed

**Panel Types Working:**
| Type | Status | Notes |
|------|--------|-------|
| feed:trending | ✅ | Default panel |
| feed:following | ✅ | Requires logged in user |
| feed:channel | ✅ | Channel picker in add flow |
| feed:search-list | ✅ | List picker in add flow |
| feed:fid-list | ✅ | List picker in add flow |
| inbox:replies | ✅ | |
| inbox:mentions | ✅ | |
| inbox:likes | ✅ | |
| inbox:recasts | ✅ | |
| inbox:follows | ✅ | |
| dms | ❌ | Intentionally skipped |

### Remaining Setup

**Database Migration Required:**
The `user_preferences` table must be created on the remote Supabase database for cross-device sync to work.

Migration file: `supabase/migrations/20260122100000_user_preferences.sql`

Apply via Supabase Dashboard SQL Editor or:

```bash
npx supabase db push
```

**Without the migration:**

- Workspace works locally (IndexedDB persistence)
- Cross-device sync will fail with 404 error
- Console shows: `relation "public.user_preferences" does not exist`

---

**Reminder**: This spec builds on `workspace-infrastructure.md`. Implement infrastructure first, then this spec adds the panel variety.
