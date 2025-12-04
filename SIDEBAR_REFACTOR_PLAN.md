# Sidebar Refactor Implementation Plan

## Overview

Separate concerns between left sidebar (navigation) and right sidebar (contextual author info).

**Current State:**
- Left sidebar (160px): Main nav only (Inbox, Feeds, Post, DMs, Lists, Search, Profile, Settings)
- Right sidebar (~256px): Mixed navigation (feeds, lists, searches, channels) - WRONG

**Target State:**
- Left sidebar (200px): Main nav + feeds/lists/searches/channels navigation
- Right sidebar (280-300px): Author context panel (profile, bio, recent casts)

---

## Phase 1: Left Sidebar Refactor

### 1.1 Increase Width
**File:** `src/home/index.tsx`

Change left sidebar width from 160px to 200px:
```tsx
// Line ~482: Change lg:w-40 to lg:w-[200px]
<div className="hidden lg:flex lg:fixed lg:h-screen lg:inset-y-0 lg:left-0 lg:z-10 lg:w-[200px] ...">

// Line ~478: Update margin to match
<div className="h-full lg:ml-[200px] flex-1">
```

### 1.2 Create LeftSidebarNav Component
**New file:** `src/common/components/Sidebar/LeftSidebarNav.tsx`

Structure:
```
┌─────────────────────────┐
│ herocast              │
├─────────────────────────┤
│ MAIN NAV                │
│ ● Inbox            ⇧N  │
│ ● Feeds            ⇧F  │
│ ● Post                  │
│ ● DMs              ⇧M  │
│ ● Search            /   │
├─────────────────────────┤
│ ▼ FEEDS                 │  <- Collapsible
│   Following        ⇧0   │
│   Trending         ⇧1   │
├─────────────────────────┤
│ ▼ SEARCHES        g s   │  <- Collapsible
│   herocast       g s 1  │
│   hellno         g s 2  │
│   [+3 more]             │
├─────────────────────────┤
│ ▼ LISTS           g l   │  <- Collapsible
│   repliooor      g l 1  │
│   team           g l 2  │
│   [+2 more]             │
├─────────────────────────┤
│ ▼ CHANNELS              │  <- Collapsible
│   🟣 Purple             │
│   🏃 Berlin             │
│   [+5 more]             │
├─────────────────────────┤
│ ⚙ Settings         ⇧,  │
│ ↑ Upgrade               │
│ 👤 Accounts       ⌘⇧A  │
├─────────────────────────┤
│ [Account Switcher]      │
└─────────────────────────┘
```

### 1.3 Collapsible Sections with State Persistence
**New file:** `src/common/hooks/useSidebarCollapseState.ts`

```tsx
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'herocast-sidebar-collapse-state';

type SectionKey = 'feeds' | 'searches' | 'lists' | 'channels';

export function useSidebarCollapseState() {
  const [collapseState, setCollapseState] = useState<Record<SectionKey, boolean>>({
    feeds: true,      // collapsed by default
    searches: true,   // collapsed by default
    lists: true,      // collapsed by default
    channels: true,   // collapsed by default
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setCollapseState(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage on change
  const toggleSection = (section: SectionKey) => {
    setCollapseState(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { collapseState, toggleSection };
}
```

### 1.4 Collapsible Section Component
**New file:** `src/common/components/Sidebar/CollapsibleNavSection.tsx`

Features:
- Click header to expand/collapse
- Show top 5 items when collapsed, all when expanded
- "Show more" / "Show less" toggle for inline expansion
- Keyboard shortcut hints on hover (opacity 0 → 70%)
- Active item indicator (left border + background)

```tsx
type CollapsibleNavSectionProps = {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
  isCollapsed: boolean;
  onToggle: () => void;
  shortcutPrefix?: string; // e.g., "g s" for searches
  maxCollapsedItems?: number; // default 5
  onItemClick: (item: NavItem) => void;
  selectedId?: string;
};
```

### 1.5 Move Navigation Components
Refactor existing components to work in left sidebar:

1. **ChannelsOverview.tsx** → Extract channel list rendering
2. **ListsOverview.tsx** → Extract list rendering (searches + fid lists)
3. Keep existing hotkey logic (`useSidebarHotkeys.ts`)

### 1.6 Update Home Layout
**File:** `src/home/index.tsx`

Replace current left sidebar content with new `LeftSidebarNav`:

```tsx
// Inside the static sidebar for desktop div
<div className="flex grow flex-col flex-1 gap-y-5 overflow-y-auto bg-background px-3">
  <Link href="/post" className="flex h-14 shrink-0 items-center">
    <h2 className="text-xl font-bold">herocast</h2>
  </Link>

  <LeftSidebarNav />

  <div className="mt-auto py-4">
    <AccountSwitcher />
  </div>
</div>
```

---

## Phase 2: Right Sidebar (Author Context Panel)

### 2.1 Create AuthorContextPanel Component
**New file:** `src/common/components/Sidebar/AuthorContextPanel.tsx`

Structure when cast selected:
```
┌─────────────────────────────┐
│ ┌───┐                       │
│ │ 🖼 │ Display Name         │
│ └───┘ @username ✓           │
│       FID: 1234             │
├─────────────────────────────┤
│ Bio text here with links    │
│ that are clickable...       │
├─────────────────────────────┤
│ 12.5K followers             │
│ 500 following               │
├─────────────────────────────┤
│ [Follow] [View Profile →]   │
├─────────────────────────────┤
│ VERIFIED ADDRESSES          │
│ 🔗 0x1234...5678            │
│ 🔗 username.eth             │
├─────────────────────────────┤
│ RECENT CASTS                │  <- Aspirational
│ ┌─────────────────────────┐ │
│ │ "Cast preview text..."  │ │
│ │ 2h • 12 ♥ • 3 ↻        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Structure when no cast selected (show current user):
```
┌─────────────────────────────┐
│ YOUR PROFILE                │
│ ┌───┐                       │
│ │ 🖼 │ Your Display Name    │
│ └───┘ @yourusername         │
├─────────────────────────────┤
│ 5.2K followers              │
│ 1.2K following              │
├─────────────────────────────┤
│ TODAY'S ACTIVITY            │  <- Aspirational
│ 3 casts                     │
│ 12 likes given              │
│ 5 new followers             │
└─────────────────────────────┘
```

### 2.2 Implementation

```tsx
import React from 'react';
import { useDataStore } from '@/stores/useDataStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { useProfile } from '@/hooks/queries/useProfile';
import ProfileInfoContent from '@/common/components/ProfileInfoContent';
import { Sidebar, SidebarContent } from '@/components/ui/sidebar';

const AuthorContextPanel = () => {
  const { selectedCast } = useDataStore();
  const currentAccount = useAccountStore(state => state.accounts[state.selectedAccountIdx]);
  const currentUserFid = currentAccount?.platformAccountId
    ? Number(currentAccount.platformAccountId)
    : undefined;

  // If cast selected, show cast author
  // Otherwise show current user
  const targetFid = selectedCast?.author?.fid || currentUserFid;

  const { data: profile, isLoading } = useProfile(
    { fid: targetFid },
    {
      viewerFid: currentUserFid,
      enabled: !!targetFid
    }
  );

  const isShowingCurrentUser = !selectedCast && currentUserFid;

  return (
    <Sidebar side="right" collapsible="none" className="border-l w-[280px]">
      <SidebarContent className="p-4">
        {isShowingCurrentUser && (
          <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">
            Your Profile
          </div>
        )}

        <ProfileInfoContent
          profile={profile || selectedCast?.author}
          showFollowButton={!isShowingCurrentUser}
          wideFormat
        />

        {/* Verified addresses section */}
        {profile?.verified_addresses?.eth_addresses?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-sidebar-border/20">
            <div className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">
              Verified Addresses
            </div>
            {profile.verified_addresses.eth_addresses.slice(0, 3).map((addr, i) => (
              <div key={i} className="text-sm text-foreground/70 font-mono truncate">
                {addr.slice(0, 6)}...{addr.slice(-4)}
              </div>
            ))}
          </div>
        )}

        {/* Recent casts - aspirational placeholder */}
        {/* TODO: Add useUserCasts hook and render recent casts */}
      </SidebarContent>
    </Sidebar>
  );
};

export default AuthorContextPanel;
```

### 2.3 Update ShadcnRightSidebar
**File:** `src/common/components/Sidebar/ShadcnRightSidebar.tsx`

Replace navigation content with AuthorContextPanel:

```tsx
// Remove: showFeeds, showSearches, showLists, showManageLists props
// Keep only: showAuthorInfo (now always true for feeds/inbox/search pages)

const ShadcnRightSidebar = () => {
  return <AuthorContextPanel />;
};
```

### 2.4 Update Right Sidebar Rendering
**File:** `src/home/index.tsx`

Simplify `renderRightSidebar`:

```tsx
const renderRightSidebar = () => {
  // Show author panel on feed-related pages
  if (['/feeds', '/inbox', '/search', '/dms'].includes(pathname) ||
      pathname.startsWith('/conversation')) {
    return <AuthorContextPanel />;
  }
  return null;
};
```

---

## Phase 3: Keyboard Shortcut Enhancements

### 3.1 Shortcut Visibility on Hover
Update item rendering to show shortcuts on hover:

```tsx
<div className="group flex items-center ...">
  <span className="flex-1">{item.name}</span>
  {item.shortcut && (
    <kbd className={cn(
      "px-1.5 py-0.5 rounded text-xs font-mono transition-opacity",
      isSelected
        ? "opacity-80 bg-primary/20"
        : "opacity-0 group-hover:opacity-70 bg-muted/50"
    )}>
      {item.shortcut}
    </kbd>
  )}
</div>
```

### 3.2 Add Missing Shortcuts
Extend `useSidebarHotkeys.ts`:
- `g>c>1-9` for channels
- `g>f` or `g>h` for Following feed
- `g>t` for Trending feed

---

## File Changes Summary

### New Files
1. `src/common/components/Sidebar/LeftSidebarNav.tsx`
2. `src/common/components/Sidebar/CollapsibleNavSection.tsx`
3. `src/common/components/Sidebar/AuthorContextPanel.tsx`
4. `src/common/hooks/useSidebarCollapseState.ts`

### Modified Files
1. `src/home/index.tsx` - Layout width changes, new components
2. `src/common/components/Sidebar/ShadcnRightSidebar.tsx` - Simplified to just author panel
3. `src/common/hooks/useSidebarHotkeys.ts` - Add channel shortcuts

### Files to Remove/Deprecate
1. Navigation props from ShadcnRightSidebar (showFeeds, showLists, etc.)

---

## Implementation Order

1. **Left sidebar width increase** (quick win, visible change)
2. **Create useSidebarCollapseState hook** (foundation)
3. **Create CollapsibleNavSection component** (reusable)
4. **Create LeftSidebarNav component** (main work)
5. **Update home/index.tsx layout** (integrate left sidebar)
6. **Create AuthorContextPanel component** (right sidebar)
7. **Update ShadcnRightSidebar** (simplify)
8. **Add keyboard shortcut enhancements** (polish)
9. **Test and iterate**

---

## Testing Checklist

- [ ] Left sidebar shows all navigation items
- [ ] Collapsible sections remember state across page refreshes
- [ ] "Show more" expands items inline
- [ ] Keyboard shortcuts work (g>s>1, g>l>1, etc.)
- [ ] Shortcuts visible on hover
- [ ] Right sidebar shows cast author when cast selected
- [ ] Right sidebar shows current user when no cast selected
- [ ] Mobile layout still works (responsive)
- [ ] No layout shifts or width issues
