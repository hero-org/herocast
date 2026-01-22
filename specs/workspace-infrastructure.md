# Workspace Infrastructure Spec

## Problem

Power users lose context when navigating between feeds, inbox, DMs, and lists. They want a "cockpit/HQ view" to monitor multiple data streams simultaneously. This spec covers the **infrastructure** - the panel system, persistence, and one basic panel type to prove it works.

## Success Criteria

1. **Layout persists**: Close browser, reopen → same panels in same positions with same widths
2. **Cross-device sync**: Configure workspace on desktop, open on laptop → same workspace appears
3. **Error isolation**: Force-crash one panel via devtools → other panels keep working, crashed panel shows "Retry" button
4. **Basic panel works**: Trending feed panel displays casts, scrolls, auto-refreshes

## Scope

### In Scope (Infrastructure Only)

- New `/workspace` route as opt-in mode
- Core panel system: add, remove, reorder (drag), resize, collapse
- 1-5 horizontal panels maximum
- Generic `PanelErrorBoundary` component
- `useWorkspaceStore` Zustand store with IndexedDB persistence
- `user_preferences` Supabase table for cross-device sync
- shadcn Resizable component (react-resizable-panels)
- Panel header: title, settings icon, collapse chevron, close X
- **One proof-of-concept panel**: `FeedPanel` showing Trending feed
- Add "Workspace" to left sidebar navigation
- Empty state with "Add your first panel" CTA
- Default workspace for first-time users (single Trending feed panel)

### Out of Scope (Deferred to Panel Types PRD)

- Inbox panels (replies, mentions, likes, recasts, follows)
- DM panels
- Feed panels for Following, Channels, Lists
- Panel-specific settings modals
- Keyboard shortcuts within panels

### Out of Scope (Not Planned)

- Mobile responsive layout
- Nested panel layouts
- Floating/detachable panels
- More than 5 panels
- Collaboration/shared workspaces

## Constraints

### Must Follow

- **Hybrid drag/resize**: `react-resizable-panels` for resize + `@dnd-kit` for panel reordering
- **IndexedDB pattern**: Use `IndexedDBStorage` from `src/stores/StoreStorage.ts`
- **Error boundary pattern**: Base on `DMErrorBoundary` from `src/common/components/DirectMessages/DMErrorBoundary.tsx`
- **Zustand + mutative**: Match all existing stores
- **Panel config structure**: `{ id, type, config, collapsed }` - extensible for future panel types
- **Add shadcn Resizable**: `pnpm dlx shadcn@latest add resizable`

### Must Avoid

- **No continuous Supabase writes**: Debounce 500ms locally, sync on blur/close only
- **No nested layouts**: Flat horizontal panels only
- **No new dependencies** beyond react-resizable-panels
- **No modifications to existing pages**: FeedPanel wraps/composes, doesn't modify `app/(app)/feeds/page.tsx`

## Technical Approach

### Architecture

```
/workspace
├── WorkspaceLayout
│   ├── DndContext (@dnd-kit)
│   │   └── ResizablePanelGroup (shadcn)
│   │       ├── SortablePanel (dnd-kit sortable + ResizablePanel)
│   │       │   ├── PanelErrorBoundary
│   │       │   │   ├── PanelHeader
│   │       │   │   └── PanelContent (FeedPanel for now)
│   │       │   └── ResizableHandle
│   │       └── ... more panels
│   └── AddPanelButton
└── Empty state (when no panels)
```

### Key Files to Create

```
app/(app)/workspace/page.tsx              # Main workspace route
src/stores/useWorkspaceStore.ts           # Workspace state + persistence
src/common/components/Workspace/
├── WorkspaceLayout.tsx                   # Main container with DnD + Resizable
├── SortablePanel.tsx                     # DnD-wrapped panel
├── PanelHeader.tsx                       # Title, collapse, close controls
├── PanelErrorBoundary.tsx                # Generic error boundary
├── PanelContent.tsx                      # Routes type → component
├── panels/
│   └── FeedPanel.tsx                     # Trending feed (proof of concept)
├── AddPanelModal.tsx                     # Panel type picker (simple for now)
└── EmptyWorkspace.tsx                    # First-time / empty state
src/components/ui/resizable.tsx           # shadcn component (via CLI)
supabase/migrations/XXXXXX_user_preferences.sql
```

### Files to Modify

```
src/common/components/Sidebar/LeftSidebarNav.tsx  # Add Workspace nav item
src/stores/initializeStores.ts                     # Init workspace store
```

### Existing Code to Leverage

- `src/stores/StoreStorage.ts` → `IndexedDBStorage` class
- `src/common/components/DirectMessages/DMErrorBoundary.tsx` → Error boundary pattern
- `src/common/components/ThreadComposer/` → @dnd-kit patterns
- `app/(app)/feeds/page.tsx` → Feed rendering logic (extract/compose into FeedPanel)
- `src/hooks/queries/useTrendingFeed.ts` → React Query hook for trending

### Data Model

```typescript
// Panel types - extensible
type PanelType = 'feed'; // Start with just feed, add more in Panel Types PRD

// Panel configuration
interface PanelConfig {
  id: string;
  type: PanelType;
  config: FeedPanelConfig; // Union type when more panels added
  collapsed: boolean;
}

// Feed panel config (only trending for now)
interface FeedPanelConfig {
  feedType: 'trending'; // Expand to 'following' | 'channel' | 'list' later
  channelUrl?: string;
  listId?: string;
}

// Workspace layout
interface WorkspaceLayout {
  panels: PanelConfig[];
  panelSizes: number[]; // Percentages, sum to 100
}

// Full preferences (extensible)
interface UserPreferences {
  workspace?: WorkspaceLayout;
  // Future: sidebarState, notificationPrefs, etc.
}
```

### Persistence Flow

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  User Action    │────▶│  Debounce    │────▶│  IndexedDB   │
│  (add/resize/   │     │  (500ms)     │     │  (immediate) │
│   reorder)      │     └──────────────┘     └──────────────┘
└─────────────────┘                                 │
                                                    ▼
                       ┌──────────────┐     ┌──────────────┐
                       │  Supabase    │◀────│  Sync Queue  │
                       │  (on blur/   │     │  (batched)   │
                       │   close)     │     └──────────────┘
                       └──────────────┘

On Load:
1. Read IndexedDB → render immediately
2. Fetch Supabase in background
3. If Supabase newer (updated_at), replace local
```

### Database Migration

```sql
-- Generic user preferences table (extensible)
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX idx_user_preferences_updated_at ON public.user_preferences(updated_at);
```

## Edge Cases

- **Empty workspace**: Show `EmptyWorkspace` component with "Add your first panel" button
- **All panels closed**: Same as empty workspace
- **Panel crashes**: Error boundary catches, shows retry UI, other panels unaffected
- **Supabase sync fails**: Continue local, queue retry, show subtle indicator (not blocking)
- **5 panel limit**: Disable add button, tooltip explains limit
- **Narrow panels**: Minimum width 200px enforced
- **User not logged in**: Local-only mode (IndexedDB), no sync
- **First-time user**: Default to single Trending feed panel

## FeedPanel Implementation Notes

For the proof-of-concept FeedPanel:

1. Extract trending feed logic from `app/(app)/feeds/page.tsx`
2. Use existing `useTrendingFeedInfinite` hook
3. Use existing `CastRow` component
4. Use existing `SelectableListWithHotkeys` for virtualization
5. Simplify: no thread view (click opens in new tab or navigates away for now)
6. Include auto-refresh on visibility (existing pattern)

```typescript
// Simplified FeedPanel props
interface FeedPanelProps {
  config: FeedPanelConfig;
  isCollapsed: boolean;
}
```

## Definition of Done

- [ ] `/workspace` route renders
- [ ] Can add a Trending feed panel
- [ ] Can remove a panel
- [ ] Can drag to reorder panels
- [ ] Can resize panels by dragging handle
- [ ] Can collapse/expand panels
- [ ] Layout persists after browser refresh (IndexedDB)
- [ ] Layout syncs to Supabase on blur/close
- [ ] Layout loads from Supabase on fresh device
- [ ] Crashing one panel doesn't crash others
- [ ] "Workspace" appears in left sidebar
- [ ] Empty state shows when no panels

---

**Next**: After this ships, implement `specs/workspace-panel-types.md` to add Inbox, DMs, Following, Channel, and List panels.

**Reminder**: This spec is your durable artifact. Before implementing: `/clear` to start with fresh context containing only this spec.
