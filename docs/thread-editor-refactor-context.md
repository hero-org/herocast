# Thread Editor Refactor: Context & Implementation Plan

## Background

This document captures the context and implementation plan for fixing the drag-and-drop content loss bug in the ThreadComposer.

---

## Current Status: STILL BROKEN

### The Core Problem

After @dnd-kit drag-and-drop reorder, TipTap editors don't render the correct content **even though store data is correct**.

**Evidence:**

- Editors appear empty after reorder
- Page refresh shows content correctly
- This is a **TipTap/React rendering issue**, not a data loss issue

---

## All Attempted Solutions (NONE WORKED)

### Attempt 1: Controlled Editor Pattern

**Idea**: Make store the single source of truth, sync immediately on every keystroke.

**Implementation**:

- Added `onContentChange` callback to `useCastEditor.ts`
- Used ref to avoid stale closure in TipTap's cached callbacks
- Removed debounced sync mechanism
- Added `handleContentChange` that calls `updateDraftById` immediately

**Result**: ❌ Store stays in sync, but editors still don't render after reorder.

---

### Attempt 2: Key-based Force Remount (Solution A)

**Idea**: Add `key={draft.id}` to force React to recreate editor when draft changes.

**Implementation**:

```tsx
<NewCastEditor key={draft.id} draft={draft} ... />
```

**Result**: ❌ Doesn't work because React PRESERVES components with matching keys and just moves them in the DOM. TipTap gets confused when its container moves.

---

### Attempt 3: Remove Dynamic Import

**Idea**: Dynamic imports cause component suspension and recreation during drag.

**Implementation**:

```tsx
// Changed from:
const NewCastEditor = dynamic(() => import('...'), { ssr: false });

// To:
import NewCastEditor from '@/common/components/Editor/NewCastEditor';
```

**Result**: ❌ No change. TipTap still doesn't render correctly.

---

### Attempt 4: Initialization Guard

**Idea**: TipTap fires `onUpdate` with empty content before effect sets content.

**Implementation**:

```tsx
const hasSetInitialContentRef = useRef(false);

const handleContentChange = (text: string) => {
  if (!hasSetInitialContentRef.current) return; // Guard
  // ...
};
```

**Result**: ❌ Prevents wrong data from being saved, but doesn't fix rendering.

---

### Attempt 5: External Change Detection

**Idea**: Detect when store changes externally (from reorder) and update editor.

**Implementation**:

```tsx
const lastSetTextRef = useRef(draft.text);

useEffect(() => {
  const isExternalStoreChange = draft.text !== lastSetTextRef.current;
  if (isExternalStoreChange) {
    editor.commands.setContent(...);
  }
}, [draft.text]);
```

**Result**: ❌ Effect runs but `setContent` doesn't update the DOM properly after @dnd-kit moves the component.

---

### Attempt 6: Stale Closure Fix with Refs

**Idea**: TipTap caches initial `onUpdate`, use ref to always get latest callback.

**Implementation**:

```tsx
const onContentChangeRef = useRef(onContentChange);
useEffect(() => {
  onContentChangeRef.current = onContentChange;
}, [onContentChange]);

// In onUpdate:
onContentChangeRef.current?.(text);
```

**Result**: ❌ Fixes stale closures but doesn't fix rendering issue.

---

## Root Cause Analysis (Updated)

### Why Key-based Approach Fails

With `key={draft.id}`:

1. Draft A at position 0, Draft B at position 1
2. User drags to reorder: B moves to position 0, A moves to position 1
3. `getThreadDrafts()` returns [B, A] instead of [A, B]
4. React renders with keys:
   - Position 0: `key={B.id}` (was at position 1)
   - Position 1: `key={A.id}` (was at position 0)
5. **React PRESERVES components with matching keys** - it doesn't destroy them
6. React just moves the DOM nodes to new positions
7. TipTap's ProseMirror view gets confused when its container DOM moves
8. Editor appears blank or wrong content

### The Real Problem

**React's key reconciliation preserves components and moves them in the DOM. TipTap doesn't handle DOM container moves gracefully.**

---

## NUCLEAR SOLUTION: Force Remount All Editors

### The Approach

Change keys after EVERY reorder so React DESTROYS and RECREATES all editor components.

```tsx
// In ThreadComposer
const [reorderVersion, setReorderVersion] = useState(0);

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = threadDrafts.findIndex((d) => d.id === active.id);
    const newIndex = threadDrafts.findIndex((d) => d.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      reorderThreadPost(threadId, oldIndex, newIndex);
      // NUCLEAR: Force all editors to destroy and recreate
      setReorderVersion((v) => v + 1);
    }
  }
};

// Use composite key that changes on reorder
{threadDrafts.map((draft, index) => (
  <ThreadPostCard
    key={`${draft.id}-${reorderVersion}`}  // Changes after reorder!
    draft={draft}
    ...
  />
))}
```

### Why This Works

1. After reorder, `reorderVersion` increments
2. ALL keys change: `draftA-0` → `draftA-1`, `draftB-0` → `draftB-1`
3. React sees completely different keys = DESTROY all old components
4. React creates fresh new components
5. New editors initialize from store (which has correct data)
6. Content renders correctly

### Tradeoffs

- **Pros**: Guaranteed to work, simple to understand
- **Cons**: Brief flicker during remount, loses focus/cursor position

---

## Implementation Checklist

- [x] Controlled editor pattern (store sync) - implemented but not sufficient
- [x] Key on NewCastEditor - implemented but not sufficient
- [x] Remove dynamic import - implemented but not sufficient
- [ ] **NUCLEAR: Composite key with reorderVersion** ← TRY THIS

---

## Files Modified So Far

| File                       | Changes                                         |
| -------------------------- | ----------------------------------------------- |
| `useCastEditor.ts`         | Added `onContentChange` callback with ref       |
| `NewCastEditor.tsx`        | Removed debounce, added controlled sync, guards |
| `ThreadComposer/index.tsx` | Simplified handleDragEnd                        |
| `ThreadPostCard.tsx`       | Removed dynamic import, added key={draft.id}    |

---

## Original Context

### GitHub Issue #666 Goal

Unify single cast editor and thread composer:

- **Cmd+Enter**: Adds a new cast to the thread
- **Cmd+Shift+Enter**: Publishes single cast or thread
- **Scheduling**: Only visible when thread has exactly 1 post

### What Was Successfully Implemented

1. ✅ Replaced `react-easy-sort` with `@dnd-kit/sortable`
2. ✅ Added drag handles on avatars
3. ✅ Publishing overlay dialog with progress
4. ✅ Fixed hotkey scopes for /post page
5. ✅ Focus jumps to new draft on Cmd+Enter
6. ✅ Channel selector for first post

### The Bug We're Fixing

When dragging to reorder posts in a thread, editors don't show the correct content (even though store has correct data).
