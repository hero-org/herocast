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

- [ ] Following feed panel works
- [ ] Channel feed panel works (with channel picker)
- [ ] Search List feed panel works (with list picker)
- [ ] FID List feed panel works (with list picker)
- [ ] Replies inbox panel works
- [ ] Mentions inbox panel works
- [ ] Likes inbox panel works
- [ ] Recasts inbox panel works
- [ ] Follows inbox panel works
- [ ] DM panel works (list + thread)
- [ ] Add Panel modal shows all options organized
- [ ] Panel headers show correct titles and icons
- [ ] Interactions (reply, like) work from panels

---

**Reminder**: This spec builds on `workspace-infrastructure.md`. Implement infrastructure first, then this spec adds the panel variety.
