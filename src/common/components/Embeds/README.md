# Embed Components

This directory contains embed components for rendering various content types (images, tweets, casts, videos, etc.) within Farcaster posts.

## Embed Component Contract

All embed components MUST follow these rules to work reliably with the EmbedCarousel and feed rendering:

### 1. Never return null/undefined during loading

**Bad:**

```tsx
if (isLoading) return; // Returns undefined - breaks carousel height tracking
if (!data) return null; // Returns null during loading
```

**Good:**

```tsx
if (isLoading) return <EmbedSkeleton variant="default" />;
```

**Why:** The EmbedCarousel uses ResizeObserver to track component heights. When a component returns null/undefined, ResizeObserver has nothing to observe, causing layout shifts when content appears.

### 2. Always render a DOM element

Even on error states, render something visible. This ensures:

- Carousel ResizeObserver can track heights
- No layout shifts when content loads
- Consistent user experience

**Example:**

```tsx
if (error) return <div className="max-w-lg p-4 text-muted-foreground">Failed to load embed</div>;
```

### 3. Use consistent max-width

Use `max-w-lg` for embed containers to maintain visual consistency across the feed.

```tsx
<div className="max-w-lg">{/* embed content */}</div>
```

### 4. Handle errors gracefully

Show a fallback UI on error, don't crash. The parent ErrorBoundary in CastRow catches unhandled errors, but prefer graceful degradation.

### 5. Loading skeleton guidelines

- Use static gray background (no animations)
- Respect aspect ratio when dimensions are known
- Use `EmbedSkeleton` component for consistency
- Skeleton should approximate final content size

**Example:**

```tsx
if (isLoading) {
  return <EmbedSkeleton variant="default" aspectRatio="16/9" />;
}
```

## Available Components

| Component         | Content Type                 | Has Loading Skeleton |
| ----------------- | ---------------------------- | -------------------- |
| ImageEmbed        | Images (jpg, png, gif, etc.) | ✅                   |
| TweetEmbed        | Twitter/X posts              | ✅ (TweetSkeleton)   |
| CastEmbed         | Farcaster casts              | ✅                   |
| VideoEmbed        | HLS video streams            | Native player        |
| OpenGraphImage    | Generic URLs with metadata   | ✅                   |
| NounsBuildEmbed   | Nouns Builder DAOs           | ✅                   |
| ParagraphXyzEmbed | Paragraph articles           | ✅                   |
| SwapEmbed         | Token swaps                  | ✅                   |
| NftSaleEmbed      | NFT sales                    | ✅                   |

## Adding a New Embed Type

1. Create component in this directory
2. Add URL pattern matching in `index.tsx` → `getEmbedForUrl()`
3. Implement loading skeleton following the contract above
4. Test in carousel with multiple embeds to verify no layout shifts
5. Ensure all states (loading, error, success) render a DOM element

## Common Pitfalls

- Returning `null` during loading states
- Missing `max-w-lg` on container elements
- Forgetting error state UI
- Loading skeletons with different sizes than final content (causes layout shift)
- Using `transform` animations that break percentage widths in virtualized lists
