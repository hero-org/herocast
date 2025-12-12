# PRD: Composer Modal Redesign

## Overview

Redesign the herocast composer modal to achieve best-in-class UX inspired by Linear, Superhuman, Typefully, and Warpcast. The goal is a distraction-free, keyboard-first, visually refined experience that works for both power users and casual users.

## Design Principles

1. **Linear-style dark aesthetic**: Glassmorphism, minimal borders, LCH color elevation
2. **Icon-only toolbar**: Compact, discoverable via tooltips
3. **Adaptive UI**: Keyboard shortcuts for power users, visual feedback for casual users
4. **Quick reply focus**: Optimized for single casts with thread support accessible

---

## Current State Problems

| Issue                 | Current                                   | Target                                       |
| --------------------- | ----------------------------------------- | -------------------------------------------- |
| Double borders        | Outer card + inner textarea border        | Single elevation, no decorative borders      |
| Title mixing dropdown | "New post as [Account]" awkward           | Clean tabs + avatar-based account            |
| Chaotic button row    | [Home] [Media] [Schedule] as text buttons | Icon-only toolbar with tooltips              |
| No character count    | Hidden or text-based                      | Circular progress indicator (Warpcast-style) |
| No avatar presence    | Just text                                 | Avatar adjacent to editor                    |
| No drafts access      | Hidden in other views                     | Tabs: Compose / Drafts                       |
| No placeholder        | Empty feels broken                        | "Start typing a new cast..."                 |

---

## Visual Design

### Modal Container

```
┌────────────────────────────────────────────────────┐
│ ┌──────────┐  ┌──────────┐                     [×] │
│ │ Compose  │  │  Drafts  │                         │
│ └──────────┘  └──────────┘                         │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌────┐                                            │
│  │ 🧑 │  Start typing a new cast...                │
│  │    │  |                                         │
│  │    │                                            │
│  └────┘  (auto-expanding contenteditable)          │
│                                                    │
│     ┌──────────────────────────────────┐           │
│     │  [Embedded link/image preview]   │           │
│     └──────────────────────────────────┘           │
│                                                    │
├────────────────────────────────────────────────────┤
│  [🏠▾] [📷] [😊] [📅]  │  ○ 280  │  [+]  │ [Cast] │
│  ↳ channel picker       │ char   │ thread│ primary│
│    with dropdown        │ count  │       │        │
└────────────────────────────────────────────────────┘
```

### Color System (Linear-inspired)

```css
/* Modal backdrop */
--backdrop: hsl(0 0% 0% / 0.6);
--backdrop-blur: 8px;

/* Modal surface - glassmorphism */
--modal-bg: hsl(var(--background) / 0.85);
--modal-border: hsl(var(--border) / 0.5);
--modal-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);

/* Toolbar */
--toolbar-bg: hsl(var(--muted) / 0.3);
--toolbar-hover: hsl(var(--muted) / 0.5);

/* Character count ring */
--ring-track: hsl(var(--muted));
--ring-progress: hsl(var(--primary));
--ring-warning: hsl(var(--warning)); /* >90% */
--ring-error: hsl(var(--destructive)); /* >100% */
```

---

## Component Architecture

### File Structure Changes

```
src/common/components/
├── Composer/
│   ├── index.tsx                    # Main composer export
│   ├── ComposerModal.tsx            # Modal wrapper (replaces NewCastModal)
│   ├── ComposerTabs.tsx             # Compose/Drafts tabs
│   ├── ComposerEditor.tsx           # TipTap editor with avatar
│   ├── ComposerToolbar.tsx          # Icon toolbar
│   ├── ComposerCharCount.tsx        # Circular character counter
│   ├── ComposerAccountPicker.tsx    # Avatar-based account switcher
│   ├── ComposerDraftsList.tsx       # Drafts tab content
│   ├── ComposerEmbedPreview.tsx     # Embed display (refactored EmbedsEditor)
│   └── ComposerThreadControls.tsx   # Add cast to thread button
└── Editor/
    ├── NewCastEditor.tsx            # DEPRECATED - migrate to Composer
    └── EmbedsEditor.tsx             # Keep for backwards compat
```

### Component Breakdown

#### 1. ComposerModal.tsx

**Purpose**: Top-level modal wrapper with glassmorphism styling

**Props**:

```typescript
interface ComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'compose' | 'drafts';
  replyTo?: CastType; // For reply context
  quoteCast?: CastType; // For quote context
}
```

**Key Changes**:

- Remove title from modal (tabs replace it)
- Add backdrop blur effect
- Use sheet-style animation (slide up on mobile)
- Handle ESC to close

#### 2. ComposerTabs.tsx

**Purpose**: Tab navigation between Compose and Drafts

**Implementation**:

```typescript
<Tabs defaultValue="compose" className="w-full">
  <TabsList className="grid w-full grid-cols-2 max-w-[200px]">
    <TabsTrigger value="compose">Compose</TabsTrigger>
    <TabsTrigger value="drafts">
      Drafts
      {draftCount > 0 && (
        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
          {draftCount}
        </Badge>
      )}
    </TabsTrigger>
  </TabsList>
  <TabsContent value="compose">
    <ComposerEditor />
  </TabsContent>
  <TabsContent value="drafts">
    <ComposerDraftsList />
  </TabsContent>
</Tabs>
```

#### 3. ComposerEditor.tsx

**Purpose**: Main editing experience with avatar

**Layout**:

```tsx
<div className="flex gap-3 p-4">
  {/* Left: Avatar with account picker */}
  <ComposerAccountPicker />

  {/* Right: Editor area */}
  <div className="flex-1 space-y-3">
    {/* Reply context (if replying) */}
    {replyTo && <ReplyContext cast={replyTo} />}

    {/* TipTap Editor */}
    <EditorContent
      editor={editor}
      className={cn(
        'min-h-[120px] max-h-[400px] overflow-y-auto',
        'prose prose-sm dark:prose-invert',
        'focus:outline-none'
      )}
    />

    {/* Embeds preview */}
    <ComposerEmbedPreview embeds={embeds} onRemove={removeEmbed} />
  </div>
</div>
```

**Editor Config Changes**:

```typescript
// Remove inner border styling
// Add auto-expand behavior
// Improve placeholder styling
Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'paragraph') {
      return 'Start typing a new cast...';
    }
    return '';
  },
  emptyNodeClass: 'text-muted-foreground',
});
```

#### 4. ComposerToolbar.tsx

**Purpose**: Icon-only action bar with tooltips

**Layout**:

```tsx
<div className="flex items-center gap-1 p-2 border-t border-border/50">
  {/* Left side: Actions */}
  <div className="flex items-center gap-1">
    {/* Channel Picker */}
    <ChannelPickerButton channel={channel} onSelect={setChannel} />

    {/* Media Upload */}
    <TooltipButton icon={<ImageIcon />} tooltip="Add image or video (⌘U)" onClick={openFilePicker} />

    {/* Emoji Picker */}
    <TooltipButton icon={<SmileIcon />} tooltip="Add emoji" onClick={openEmojiPicker} />

    {/* Schedule */}
    <ScheduleButton scheduledFor={scheduledFor} onSchedule={setScheduledFor} />
  </div>

  {/* Spacer */}
  <div className="flex-1" />

  {/* Right side: Count + Actions */}
  <div className="flex items-center gap-2">
    <ComposerCharCount count={charCount} max={320} />

    {/* Add to thread */}
    <TooltipButton
      icon={<PlusIcon />}
      tooltip="Add another cast to thread"
      onClick={addToThread}
      variant="outline"
      className="rounded-full"
    />

    {/* Primary action */}
    <Button onClick={handleSubmit} disabled={!canSubmit} className="min-w-[80px]">
      {scheduledFor ? 'Schedule' : 'Cast'}
    </Button>
  </div>
</div>
```

#### 5. ComposerCharCount.tsx

**Purpose**: Circular progress indicator for character limit

**Implementation**:

```tsx
interface CharCountProps {
  count: number;
  max: number;
}

export function ComposerCharCount({ count, max }: CharCountProps) {
  const percentage = Math.min((count / max) * 100, 100);
  const remaining = max - count;
  const isWarning = percentage > 90;
  const isError = percentage >= 100;

  // SVG circle parameters
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative h-6 w-6 flex items-center justify-center">
      <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
        {/* Background track */}
        <circle cx="12" cy="12" r={radius} className="stroke-muted fill-none" strokeWidth="2" />
        {/* Progress arc */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          className={cn(
            'fill-none transition-all duration-150',
            isError ? 'stroke-destructive' : isWarning ? 'stroke-warning' : 'stroke-primary'
          )}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>

      {/* Show remaining count when close to limit */}
      {isWarning && (
        <span className={cn('absolute text-[10px] font-medium', isError ? 'text-destructive' : 'text-warning')}>
          {remaining}
        </span>
      )}
    </div>
  );
}
```

#### 6. ComposerAccountPicker.tsx

**Purpose**: Avatar-based account switcher

**Layout**:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button className="flex flex-col items-center gap-1 group">
      <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
        <AvatarImage src={account.user?.pfp_url} />
        <AvatarFallback>{account.name[0]}</AvatarFallback>
      </Avatar>
      {hasMultipleAccounts && <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />}
    </button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-[200px] p-1">
    {accounts.map((acc) => (
      <button
        key={acc.id}
        onClick={() => selectAccount(acc.id)}
        className={cn(
          'flex items-center gap-2 w-full p-2 rounded-md',
          'hover:bg-muted transition-colors',
          acc.id === account.id && 'bg-muted'
        )}
      >
        <Avatar className="h-6 w-6">
          <AvatarImage src={acc.user?.pfp_url} />
        </Avatar>
        <span className="text-sm">{acc.name}</span>
        {acc.id === account.id && <CheckIcon className="h-4 w-4 ml-auto" />}
      </button>
    ))}
  </PopoverContent>
</Popover>
```

#### 7. ComposerDraftsList.tsx

**Purpose**: List of saved drafts with quick actions

**Layout**:

```tsx
<div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
  {drafts.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      <FileTextIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No drafts yet</p>
      <p className="text-xs">Drafts are saved automatically</p>
    </div>
  ) : (
    drafts.map((draft) => (
      <DraftItem
        key={draft.id}
        draft={draft}
        onSelect={() => loadDraft(draft)}
        onDelete={() => deleteDraft(draft.id)}
      />
    ))
  )}
</div>;

// DraftItem component
function DraftItem({ draft, onSelect, onDelete }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg',
        'border border-border/50 hover:border-border',
        'cursor-pointer transition-colors group'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2">{draft.text || '(empty draft)'}</p>
        <div className="flex items-center gap-2 mt-1">
          {draft.parentUrl && (
            <Badge variant="outline" className="text-xs">
              {getChannelNameFromUrl(draft.parentUrl)}
            </Badge>
          )}
          {draft.scheduledFor && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />
              {formatRelativeTime(draft.scheduledFor)}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

## Keyboard Shortcuts

| Shortcut    | Action                | Scope          |
| ----------- | --------------------- | -------------- |
| `⌘+Enter`   | Submit cast           | Editor focused |
| `⌘+Shift+D` | Save as draft         | Editor focused |
| `⌘+Shift+S` | Open schedule picker  | Editor focused |
| `⌘+U`       | Upload media          | Editor focused |
| `⌘+K`       | Insert link           | Editor focused |
| `Esc`       | Close modal           | Modal open     |
| `Tab`       | Navigate toolbar      | Modal open     |
| `⌘+1`       | Switch to Compose tab | Modal open     |
| `⌘+2`       | Switch to Drafts tab  | Modal open     |

---

## Animation & Transitions

### Modal Enter/Exit

```css
/* Enter */
@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Exit */
@keyframes modal-exit {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
```

### Character Count

```css
/* Smooth color transition */
.char-count-ring {
  transition: stroke 150ms ease-out;
}

/* Pulse animation when at limit */
@keyframes pulse-warning {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.char-count-ring.at-limit {
  animation: pulse-warning 1s infinite;
}
```

---

## State Management Updates

### useDraftStore Additions

```typescript
interface DraftStoreState {
  // Existing...

  // New: Active composer state
  composerState: {
    activeTab: 'compose' | 'drafts';
    currentDraftId: UUID | null;
    replyContext: CastType | null;
    quoteContext: CastType | null;
  };

  // Actions
  setComposerTab: (tab: 'compose' | 'drafts') => void;
  loadDraftIntoComposer: (draftId: UUID) => void;
  clearComposerContext: () => void;
}
```

### useNavigationStore Updates

```typescript
// Update CastModalView enum if needed
enum CastModalView {
  New = 'new',
  Reply = 'reply',
  Quote = 'quote',
}

// Add composer-specific state
interface NavigationState {
  // Existing...
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
}
```

---

## Migration Plan

### Phase 1: New Component Structure (Non-breaking)

1. Create `src/common/components/Composer/` directory
2. Build all new components alongside existing ones
3. Add feature flag: `NEXT_PUBLIC_NEW_COMPOSER=true`
4. Test new composer in isolation

### Phase 2: Integration

1. Update `NewCastModal.tsx` to conditionally render new or old composer
2. Wire up state management connections
3. Test all flows: new cast, reply, quote, schedule

### Phase 3: Cleanup

1. Remove feature flag
2. Delete old `NewCastEditor.tsx`
3. Update any remaining references
4. Document new architecture

---

## Testing Checklist

### Visual

- [ ] Modal glassmorphism effect works in light/dark mode
- [ ] Tabs animate smoothly
- [ ] Character count ring animates color transitions
- [ ] Avatar picker dropdown positions correctly
- [ ] Embeds preview renders all types (images, links, quotes)
- [ ] Mobile responsive layout works

### Functional

- [ ] Create new cast with text only
- [ ] Create cast with image/video
- [ ] Create cast in channel
- [ ] Reply to existing cast
- [ ] Quote cast
- [ ] Schedule cast
- [ ] Switch accounts mid-compose
- [ ] Save draft (auto and manual)
- [ ] Load draft from list
- [ ] Delete draft
- [ ] Add multiple casts to thread
- [ ] Character limit validation
- [ ] Mention suggestions work
- [ ] Channel suggestions work

### Keyboard

- [ ] ⌘+Enter submits
- [ ] Esc closes modal
- [ ] Tab navigation works
- [ ] All shortcuts documented work

### Accessibility

- [ ] Focus management on modal open/close
- [ ] Screen reader announces modal
- [ ] Tab order is logical
- [ ] Color contrast meets WCAG AA

---

## Success Metrics

1. **Time to post**: Reduce average time from modal open to cast published
2. **Draft usage**: Increase in drafts saved/loaded
3. **Schedule adoption**: Track scheduled cast creation rate
4. **Error rate**: Reduce failed post attempts
5. **User feedback**: Qualitative improvement in composer satisfaction

---

## Open Questions

1. **Thread UX**: Should thread casts be inline (vertical stack) or horizontal cards?
2. **Draft auto-save**: How often? On blur? On debounce?
3. **Emoji picker**: Build custom or use library (emoji-mart)?
4. **Mobile**: Bottom sheet or centered modal?
5. **Reply context**: How much of parent cast to show?

---

## Dependencies

- **Existing**: Tabs, Tooltip, Avatar, Popover, Badge (all in `src/components/ui/`)
- **TipTap**: Continue using existing editor setup
- **New**: May need emoji picker library

---

---

# Part 2: Post Page Redesign

The `/post` page is the standalone content management view. While the modal is for quick compose, the page is for dedicated content workflow management.

## Mental Model: Modal vs. Page

| Aspect             | Modal                      | Page                            |
| ------------------ | -------------------------- | ------------------------------- |
| **Purpose**        | Quick post NOW             | Content management studio       |
| **Entry**          | Shortcut (n), reply, quote | Sidebar nav to /post            |
| **Lifetime**       | Ephemeral                  | Persistent session              |
| **Tabs**           | Compose / Drafts           | Writing / Scheduled / Published |
| **Primary Action** | Post single cast           | Manage content pipeline         |
| **Exit**           | Post, cancel, or ESC       | Navigate away                   |

## Current Post Page Problems

### Problem 1: Triple Redundancy

"New draft" button appears in THREE places:

- Header (top right)
- Left sidebar
- Center empty state card

### Problem 2: Empty State Paradox

- "Writing" tab is selected
- But center shows "New draft" card instead of an editor
- User must click a button to get an editor
- **Violates:** "Always be ready to write" principle

### Problem 3: No Clear Hierarchy

- Left panel (draft list) and center panel have equal visual weight
- Header title "Post" provides no actionable context
- Tab placement in sidebar feels buried

### Problem 4: Confusing Information Architecture

- Writing = drafts in progress (but shows a list, not an editor)
- Scheduled = future posts
- Published = past posts
- The "Writing" tab doesn't match mental model of "I'm writing right now"

---

## Proposed Page Design

### Visual Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  ◀ Back    Content Studio                        [@hellno ▾]       │
├──────────────────────┬─────────────────────────────────────────────┤
│                      │                                             │
│  ┌────────────────┐  │  ┌────┐                                     │
│  │ + New Draft    │  │  │ 🧑 │  Start typing a new cast...         │
│  └────────────────┘  │  │    │  |                                  │
│                      │  └────┘                                     │
│  ──────────────────  │                                             │
│  ALL DRAFTS          │         (editor area - same as modal)       │
│  ──────────────────  │                                             │
│                      │  ┌──────────────────────────────────┐       │
│  ┌────────────────┐  │  │  [Embedded content preview]      │       │
│  │ Draft 1...     │  │  └──────────────────────────────────┘       │
│  │ 2 mins ago     │  │                                             │
│  └────────────────┘  │  ────────────────────────────────────────── │
│                      │                                             │
│  ┌────────────────┐  │  [🏠▾] [📷] [😊] [📅]    ○ 280   [+] [Cast] │
│  │ Draft 2...     │  │                                             │
│  │ 1 hour ago     │  │                                             │
│  └────────────────┘  │                                             │
│                      │                                             │
│  ──────────────────  ├─────────────────────────────────────────────┤
│  SCHEDULED (3)       │  ┌─────────────────────────────────────────┐│
│  ──────────────────  │  │  Queue Preview                          ││
│                      │  │  ───────────────                        ││
│  ┌────────────────┐  │  │  Today: 2 posts                         ││
│  │ 📅 Post 3...   │  │  │  Tomorrow: 1 post                       ││
│  │ Today 2:00 PM  │  │  │  This week: 3 posts                     ││
│  └────────────────┘  │  └─────────────────────────────────────────┘│
│                      │                                             │
│  ──────────────────  │                                             │
│  PUBLISHED           │                                             │
│  ──────────────────  │                                             │
│                      │                                             │
└──────────────────────┴─────────────────────────────────────────────┘
     280px fixed              Flexible (fill remaining)
```

### Key Design Decisions

#### 1. Always Show Editor

- **Never** show empty state in center
- When no draft selected: auto-create new draft or show editor with placeholder
- Editor is always visible and ready to receive input

#### 2. Sidebar = Draft Navigator (not tabs)

- Remove tabs from sidebar
- Show collapsible sections: ALL DRAFTS, SCHEDULED, PUBLISHED
- Each section shows count in parentheses
- Clicking draft loads it into editor

#### 3. Header Simplification

- Remove redundant "New draft" button from header
- Rename "Post" to "Content Studio" or just remove title
- Add account picker to header (consistent with modal)

#### 4. Queue Preview Panel (Optional)

- Show upcoming scheduled posts timeline
- Only visible when scheduled posts exist
- Can be collapsed

---

## Component Reuse Strategy

### Shared Between Modal and Page

| Component               | Modal Usage     | Page Usage               |
| ----------------------- | --------------- | ------------------------ |
| `ComposerEditor`        | Main editor     | Center panel editor      |
| `ComposerToolbar`       | Bottom toolbar  | Below editor             |
| `ComposerCharCount`     | In toolbar      | In toolbar               |
| `ComposerAccountPicker` | Left of editor  | Header or left of editor |
| `ComposerEmbedPreview`  | Below editor    | Below editor             |
| `DraftListItem`         | Drafts tab list | Sidebar list             |

### Page-Specific Components

```
app/(app)/post/
├── page.tsx                      # Page layout orchestration
├── components/
│   ├── ContentStudioSidebar.tsx  # Left panel with draft sections
│   ├── DraftSectionGroup.tsx     # Collapsible section (All/Scheduled/Published)
│   ├── QueuePreviewPanel.tsx     # Optional right panel
│   └── ContentStudioHeader.tsx   # Simplified header
```

---

## Information Architecture Changes

### Before (Confusing)

```
/post
├── Tab: Writing      → Shows list of drafts (not an editor!)
├── Tab: Scheduled    → Shows list of scheduled
└── Tab: Published    → Shows list of published
```

### After (Clear)

```
/post
├── Sidebar
│   ├── + New Draft button
│   ├── Section: ALL DRAFTS (expandable)
│   │   └── [draft items...]
│   ├── Section: SCHEDULED (3) (expandable)
│   │   └── [scheduled items...]
│   └── Section: PUBLISHED (expandable)
│       └── [published items...]
│
├── Center: ALWAYS an editor
│   └── Selected draft OR new draft
│
└── Optional Right Panel: Queue preview
```

---

## State Synchronization

### Draft Selection Flow

```
1. User clicks draft in sidebar
2. Draft loads into editor (same TipTap instance)
3. URL updates: /post?draft=<uuid>
4. Changes auto-save back to draft store

If user navigates away:
- Unsaved changes → prompt "Save draft?"
- Already saved → navigate freely
```

### Modal ↔ Page Handoff

```
Scenario: User opens modal, writes draft, navigates to /post

Modal stores draft in:
- useDraftStore.drafts[]
- With status: DraftStatus.writing

Page reads from:
- Same useDraftStore.drafts[]
- Can select and edit any draft

The draft is shared state - no duplication.
```

---

## Mobile Considerations

### Page on Mobile (<1024px)

```
┌────────────────────────────┐
│  Content Studio    [≡]     │  ← Hamburger opens sidebar sheet
├────────────────────────────┤
│                            │
│  ┌────┐                    │
│  │ 🧑 │  Start typing...   │
│  └────┘                    │
│                            │
│  (full-width editor)       │
│                            │
├────────────────────────────┤
│  [🏠▾] [📷] [😊] [📅]      │
│              ○ 280  [Cast] │
└────────────────────────────┘
```

- Sidebar becomes slide-out sheet (hamburger menu)
- Editor takes full width
- Toolbar at bottom (thumb-friendly)
- Same components, different layout

---

## Updated File Structure

```
src/common/components/
├── Composer/
│   ├── index.tsx
│   ├── ComposerModal.tsx           # Modal wrapper
│   ├── ComposerEditor.tsx          # Shared editor
│   ├── ComposerToolbar.tsx         # Shared toolbar
│   ├── ComposerCharCount.tsx       # Shared char count
│   ├── ComposerAccountPicker.tsx   # Shared account picker
│   ├── ComposerEmbedPreview.tsx    # Shared embed preview
│   ├── ComposerDraftsList.tsx      # Simple list for modal
│   └── ComposerThreadControls.tsx  # Thread button

app/(app)/post/
├── page.tsx                        # Page orchestration
├── components/
│   ├── ContentStudioLayout.tsx     # Three-column layout
│   ├── ContentStudioSidebar.tsx    # Left panel
│   ├── DraftSectionGroup.tsx       # Collapsible section
│   ├── QueuePreviewPanel.tsx       # Right panel (optional)
│   └── MobileSidebarSheet.tsx      # Mobile navigation
└── hooks/
    └── useContentStudio.ts         # Page-specific state
```

---

## Updated Testing Checklist

### Page-Specific Tests

- [ ] Editor always visible (no empty center state)
- [ ] Draft selection loads into editor
- [ ] URL updates on draft selection
- [ ] New draft button creates and selects draft
- [ ] Sections collapse/expand properly
- [ ] Scheduled section shows correct count
- [ ] Published section shows correct count
- [ ] Mobile sidebar sheet works
- [ ] Draft deletion removes from list
- [ ] Draft duplication works
- [ ] Navigating away prompts save if dirty

### Integration Tests

- [ ] Draft created in modal appears in page
- [ ] Draft edited in page appears in modal drafts tab
- [ ] Scheduled draft shows in both views
- [ ] Published draft shows in page only

---

## Updated Timeline

1. **PR 1**: Shared composer components (ComposerEditor, ComposerToolbar, etc.)
2. **PR 2**: ComposerModal implementation
3. **PR 3**: ComposerDraftsList for modal
4. **PR 4**: ContentStudioSidebar + DraftSectionGroup
5. **PR 5**: Post page layout integration
6. **PR 6**: Mobile responsive layouts
7. **PR 7**: Queue preview panel (optional)
8. **PR 8**: Migration + cleanup old components

---

# Part 3: Draft Store Analysis & Refactoring

## Current Architecture Problems

### Problem 1: Modal Deletes Draft on Close (Line 80-88 in NewCastModal.tsx)

```typescript
useEffect(() => {
  if (!open && draftId !== undefined) {
    const timeoutId = setTimeout(() => {
      removePostDraftById(draftId); // ⚠️ ALWAYS deletes draft!
    }, 100);
    return () => clearTimeout(timeoutId);
  }
}, [open, draftId, removePostDraftById]);
```

**Issue**: Every time the modal closes, the draft is deleted - even if the user wrote content and wants to save it.

**Expected behavior**:

- If draft has content → Keep it (save to drafts)
- If draft is empty → Delete it (cleanup)
- If draft was published → Delete it (cleanup)

### Problem 2: Two Separate "Modal Open" States

```typescript
// useNavigationStore.ts
isNewCastModalOpen: boolean;
castModalDraftId?: UUID;

// useDraftStore.ts
isDraftsModalOpen: boolean;  // ⚠️ Different modal!
```

**Issue**: Two different stores manage modal state for related but different modals (cast modal vs drafts modal on mobile). This creates confusion and potential sync issues.

### Problem 3: Draft Index vs Draft ID Mismatch

```typescript
// useDraftStore.ts
updatePostDraft: (draftIdx: number, post: DraftType) => void;  // Uses INDEX
removePostDraft: (draftIdx: number) => void;                   // Uses INDEX
removePostDraftById: (draftId: UUID) => void;                  // Uses ID

// NewCastEditor.tsx
const draftIdx = drafts.findIndex((draft) => draft.id === draftId);
// Then uses draftIdx throughout...
```

**Issue**: Mixing index-based and ID-based operations. Index can become stale if drafts array changes during async operations. This is a race condition waiting to happen.

### Problem 4: Storage Strategy Split

```typescript
// useDraftStore.ts - Line 605-613
persist(mutative(store), {
  name: 'herocast-post-store',
  storage: createJSONStorage(() => sessionStorage),  // ⚠️ Session storage!
  partialize: (state) => ({
    drafts: state.drafts,
    isHydrated: state.isHydrated,
  }),
})

// But also...
hydrate: async () => {
  supabaseClient.from('draft').select('*')...  // ⚠️ Also loads from DB!
}
```

**Issue**: Drafts are stored in THREE places:

1. **SessionStorage** (persisted via zustand) - Lost on tab close
2. **Supabase DB** (only scheduled/published drafts)
3. **Memory** (during session)

This creates confusion about which is the source of truth.

### Problem 5: Async Operations Inside set()

```typescript
// useDraftStore.ts - Line 424-465
publishPostDraft: async (draftIdx: number, ...) => {
  set(async (state) => {  // ⚠️ async inside set!
    // ...
    await state.updatePostDraft(draftIdx, {...});  // ⚠️ Calling store action inside set
    const castBody = await prepareCastBody(draft);
    // ...
  });
}
```

**Issue**: Zustand's `set` should be synchronous. Putting async operations inside can cause state to be out of sync. Actions should be called outside `set`, not inside.

### Problem 6: Tight Coupling Between Draft and Navigation

```typescript
// newPostCommands (useDraftStore.ts line 616-637)
action: () => {
  useDraftStore.getState().addNewPostDraft({
    onSuccess(draftId) {
      const { setCastModalView, openNewCastModal, setCastModalDraftId } = useNavigationStore.getState();
      setCastModalView(CastModalView.New);
      setCastModalDraftId(draftId);
      openNewCastModal();
    },
  });
};
```

**Issue**: Draft creation is tightly coupled to modal opening. Creating a draft should be a pure data operation, not tied to UI navigation.

### Problem 7: Duplicated Draft Detection Logic

```typescript
// addNewPostDraft (lines 313-338)
if (!force && !text && !parentUrl && !parentCastId && !embeds) {
  for (let i = 0; i < pendingDrafts.length; i++) {
    if (!draft.text && !draft.parentUrl && !draft.parentCastId && !draft.embeds) {
      onSuccess?.(draft.id);
      return; // Reuse existing empty draft
    }
  }
}
if (!force && (parentUrl || parentCastId)) {
  for (let i = 0; i < pendingDrafts.length; i++) {
    if (parentUrl === draft.parentUrl || parentCastId?.hash === draft.parentCastId?.hash) {
      onSuccess?.(draft.id);
      return; // Reuse existing reply draft
    }
  }
}
```

**Issue**: Complex duplicate detection scattered in creation logic. Should be a separate utility function.

---

## Proposed Refactoring

### New Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  useDraftStore (Pure Data)                                       │
│  ├── drafts: DraftType[]                                         │
│  ├── CRUD operations (ID-based only)                             │
│  └── NO UI/navigation logic                                      │
│                                                                  │
│  useDraftPersistence (Side Effects)                              │
│  ├── syncToSessionStorage()                                      │
│  ├── syncToSupabase()                                            │
│  └── hydrate()                                                   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        UI LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  useComposerState (UI State)                                     │
│  ├── isModalOpen: boolean                                        │
│  ├── activeDraftId: UUID | null                                  │
│  ├── mode: 'new' | 'reply' | 'quote'                             │
│  ├── replyToContext: CastType | null                             │
│  └── openComposer() / closeComposer()                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Refactored Store: useDraftStore

```typescript
interface DraftStore {
  // State
  drafts: DraftType[];

  // Pure CRUD (ID-based only)
  createDraft: (props: CreateDraftProps) => UUID;
  updateDraft: (id: UUID, updates: Partial<DraftType>) => void;
  deleteDraft: (id: UUID) => void;
  getDraft: (id: UUID) => DraftType | undefined;

  // Queries
  getWritingDrafts: () => DraftType[];
  getScheduledDrafts: () => DraftType[];
  getPublishedDrafts: () => DraftType[];
  findDraftByParent: (parentUrl?: string, parentCastId?: ParentCastIdType) => DraftType | undefined;

  // Actions (orchestrate CRUD + side effects)
  publishDraft: (id: UUID, account: AccountObjectType) => Promise<string>;
  scheduleDraft: (id: UUID, scheduledFor: Date) => Promise<void>;

  // Lifecycle
  hydrate: () => Promise<void>;
  isHydrated: boolean;
}
```

### New Store: useComposerState

```typescript
interface ComposerState {
  // State
  isOpen: boolean;
  activeDraftId: UUID | null;
  mode: 'new' | 'reply' | 'quote';
  replyToContext: CastType | null;
  quoteContext: CastType | null;

  // Actions
  openNewComposer: (options?: { parentUrl?: string }) => void;
  openReplyComposer: (cast: CastType) => void;
  openQuoteComposer: (cast: CastType) => void;
  closeComposer: (options?: { keepDraft?: boolean }) => void;
  switchToDraft: (draftId: UUID) => void;
}
```

### Key Behavior Changes

#### 1. Smart Draft Cleanup on Modal Close

```typescript
closeComposer: ({ keepDraft = false } = {}) => {
  const draft = getDraft(activeDraftId);

  if (!keepDraft && draft) {
    const isEmpty = !draft.text?.trim() && !draft.embeds?.length;
    const wasPublished = draft.status === DraftStatus.published;

    if (isEmpty || wasPublished) {
      deleteDraft(activeDraftId);
    }
    // Otherwise: Draft has content, keep it!
  }

  set({ isOpen: false, activeDraftId: null });
};
```

#### 2. ID-Only Operations (No More Indexes)

```typescript
// Before (fragile):
updatePostDraft(draftIdx, { ...draft, text: newText });

// After (robust):
updateDraft(draftId, { text: newText });
```

#### 3. Separated Async from Sync

```typescript
// Before (async inside set):
publishPostDraft: async () => {
  set(async (state) => { ... });  // Bad!
}

// After (async outside set):
publishDraft: async (id: UUID, account) => {
  const draft = get().getDraft(id);
  set(state => { state.drafts[idx].status = 'publishing'; });  // Sync

  const hash = await submitCast(...);  // Async outside set

  set(state => { state.drafts[idx].status = 'published'; });  // Sync
}
```

#### 4. Clear Storage Strategy

```typescript
// Tier 1: Memory (current session)
// - All drafts live here during app usage
// - Fast access, no latency

// Tier 2: IndexedDB (local persistence)
// - Drafts with status: 'writing'
// - Survives tab close, but local to device

// Tier 3: Supabase (server sync)
// - Drafts with status: 'scheduled' | 'published'
// - Cross-device sync, required for scheduling
```

---

## Migration Path

### Phase 0: Bug Fixes (Can Do Now)

- [ ] Fix: Don't delete non-empty drafts on modal close
- [ ] Fix: Use ID-based operations consistently
- [ ] Fix: Move async logic outside of set()

### Phase 1: Extract Composer State

- [ ] Create useComposerState hook
- [ ] Move modal open/close logic from useNavigationStore
- [ ] Update components to use new hook

### Phase 2: Refactor Draft Store

- [ ] Convert all index-based operations to ID-based
- [ ] Extract persistence logic to separate module
- [ ] Add proper TypeScript types

### Phase 3: Improve Persistence

- [ ] Replace sessionStorage with IndexedDB for writing drafts
- [ ] Keep Supabase sync for scheduled/published
- [ ] Add offline support

---

## Immediate Fixes (Before Full Refactor)

### Fix 1: Smart Draft Cleanup

```typescript
// NewCastModal.tsx - Replace lines 80-88
useEffect(() => {
  if (!open && draftId !== undefined) {
    const timeoutId = setTimeout(() => {
      const draft = drafts.find((d) => d.id === draftId);

      // Only delete if empty or published
      const shouldDelete =
        !draft || (!draft.text?.trim() && !draft.embeds?.length) || draft.status === DraftStatus.published;

      if (shouldDelete) {
        removePostDraftById(draftId);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }
}, [open, draftId, drafts, removePostDraftById]);
```

### Fix 2: Expose findDraftByParent Utility

```typescript
// useDraftStore.ts - Add to store
findDraftByParent: (parentUrl?: string, parentCastId?: ParentCastIdType) => {
  return get().drafts.find(
    (draft) =>
      draft.status === DraftStatus.writing &&
      ((parentUrl && draft.parentUrl === parentUrl) || (parentCastId && draft.parentCastId?.hash === parentCastId.hash))
  );
};
```

### Fix 3: Use ID-Based Update

```typescript
// useDraftStore.ts - Add ID-based update
updateDraftById: (draftId: UUID, updates: Partial<DraftType>) => {
  set((state) => {
    const idx = state.drafts.findIndex((d) => d.id === draftId);
    if (idx !== -1) {
      state.drafts[idx] = { ...state.drafts[idx], ...updates };
    }
  });
};
```

---

## Files Affected by Refactor

| File                                             | Changes                       |
| ------------------------------------------------ | ----------------------------- |
| `src/stores/useDraftStore.ts`                    | Major refactor                |
| `src/stores/useNavigationStore.ts`               | Remove draft-related state    |
| `src/stores/useComposerState.ts`                 | **NEW** - Composer UI state   |
| `src/common/components/NewCastModal.tsx`         | Use new hooks                 |
| `src/common/components/Editor/NewCastEditor.tsx` | Use ID-based operations       |
| `app/(app)/post/page.tsx`                        | Use new hooks                 |
| `app/(app)/feeds/page.tsx`                       | Use new hooks for reply/quote |
| `src/common/components/CastRow.tsx`              | Use new hooks for reply/quote |
