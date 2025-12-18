# Embed Loading States Implementation Plan

## Problem Statement

Embeds render inconsistently during loading - some show skeletons, others return `null`/`undefined`, causing layout shifts in carousels and unpredictable heights.

## Goals

1. All embeds show a skeleton/placeholder during loading
2. No embed returns `null` or `undefined` during loading state
3. Document the embed contract for future contributors
4. Ensure carousel ResizeObserver can track height changes reliably

---

## Implementation Tasks

### Task 1: Create Embed Guidelines Documentation

**File:** `src/common/components/Embeds/README.md`

Document the contract that all embed components must follow:

- Must always render a DOM element (never return `null`/`undefined`)
- Must show a loading skeleton during async data fetching
- Should have a consistent max-width (`max-w-lg`)
- Should handle error states gracefully

### Task 2: Create Generic EmbedSkeleton Component

**File:** `src/common/components/Embeds/EmbedSkeleton.tsx`

A reusable skeleton component with variants:

- `default` - generic card-like skeleton (for links, articles)
- `media` - square/rectangular skeleton (for images, videos)
- `social` - tweet/cast-like skeleton (header + body + footer)

This provides consistency and reduces per-embed skeleton code.

### Task 3: Fix TweetEmbed

**File:** `src/common/components/Embeds/TweetEmbed.tsx`

Current (line 57):

```tsx
if (isLoading) return; // BUG: returns undefined
```

Fix:

```tsx
if (isLoading) return <TweetSkeleton />; // Use react-tweet's built-in skeleton
```

**Risk:** Low - TweetSkeleton is already imported, just not used.

### Task 4: Fix CastEmbed

**File:** `src/common/components/Embeds/CastEmbed.tsx`

Current (line 53):

```tsx
if ((!url && !castId) || isEmpty(cast)) return null;
```

Fix:

- Add loading state tracking
- Show skeleton while fetching
- Only return null for invalid props (no url AND no castId)

```tsx
const [isLoading, setIsLoading] = useState(true);

// During fetch...
if (isLoading) return <EmbedSkeleton variant="social" />;
if (!cast) return null; // Only after loading completes
```

**Risk:** Medium - Need to track loading state properly.

### Task 5: Fix ParagraphXyzEmbed

**File:** `src/common/components/Embeds/ParagraphXyzEmbed.tsx`

Current (line 24-26):

```tsx
if (!data) {
  return; // BUG: returns undefined
}
```

Fix:

```tsx
const [isLoading, setIsLoading] = useState(true);

if (isLoading) return <EmbedSkeleton variant="default" />;
if (!data) return <EmbedSkeleton variant="default" />; // Or error state
```

**Risk:** Low - straightforward state addition.

### Task 6: Fix NounsBuildEmbed

**File:** `src/common/components/Embeds/NounsBuildEmbed.tsx`

Current (line 220-223):

```tsx
return (
  <div className="..." key={...}>
    {!isEmpty(data) && renderContent()}  // Empty div when loading
  </div>
);
```

Fix:

```tsx
const [isLoading, setIsLoading] = useState(true);

if (isLoading) return <EmbedSkeleton variant="default" />;
// ... rest of render
```

**Risk:** Low - straightforward state addition.

### Task 7: Review VideoEmbed

**File:** `src/common/components/Embeds/VideoEmbed.tsx`

Current: Renders immediately with `height="auto"`.

Assessment needed:

- Does ReactHlsPlayer show anything during load?
- May need poster frame or skeleton

**Risk:** Low - video player likely handles its own loading state.

### Task 8: Update renderEmbedForUrl with Fallback

**File:** `src/common/components/Embeds/index.tsx`

Add defensive wrapper that catches any embed returning null:

```tsx
export const renderEmbedForUrl = (...) => {
  const embed = getEmbedForUrl(url, hideReactions, skipIntersection);

  // Defensive: if embed is null/undefined, show fallback
  if (!embed) {
    return <EmbedSkeleton variant="default" />;
  }

  return (
    <div className="flex flex-col">
      {embed}
      {onRemove && <RemoveButton />}
    </div>
  );
};
```

**Risk:** Low - purely defensive, doesn't change happy path.

---

## File Changes Summary

| File                           | Change Type       | Risk   |
| ------------------------------ | ----------------- | ------ |
| `Embeds/README.md`             | New file          | None   |
| `Embeds/EmbedSkeleton.tsx`     | New file          | None   |
| `Embeds/TweetEmbed.tsx`        | One-line fix      | Low    |
| `Embeds/CastEmbed.tsx`         | Add loading state | Medium |
| `Embeds/ParagraphXyzEmbed.tsx` | Add loading state | Low    |
| `Embeds/NounsBuildEmbed.tsx`   | Add loading state | Low    |
| `Embeds/VideoEmbed.tsx`        | Review only       | Low    |
| `Embeds/index.tsx`             | Add fallback      | Low    |

---

## Testing Plan

1. **Visual testing:** Open feed with various embed types, verify skeletons appear
2. **Carousel testing:** Test cast with multiple embeds, verify no layout jumps
3. **Error states:** Test with invalid URLs, verify graceful degradation
4. **Performance:** Ensure skeletons don't cause unnecessary re-renders

---

## Order of Implementation

1. Task 1 (README) - Establish contract first
2. Task 2 (EmbedSkeleton) - Create shared component
3. Task 3 (TweetEmbed) - Quickest win, one-line fix
4. Task 8 (renderEmbedForUrl fallback) - Safety net
5. Tasks 4-6 (CastEmbed, ParagraphXyzEmbed, NounsBuildEmbed) - Individual fixes
6. Task 7 (VideoEmbed) - Review and fix if needed

---

## Design Decisions

1. **Skeleton style:** Static gray (no animation)
2. **Skeleton height:** Respect aspect ratio when known, otherwise simple clean default
3. **Error boundaries:** One per CastRow (wrapping EmbedCarousel) is sufficient
