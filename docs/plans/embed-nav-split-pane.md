# Embed Navigation: Split-Pane Feed Plan

**Branch:** `hellno/embed-nav-modes`
**Status:** Ready for implementation. CEO review + Design review + Eng review complete.
**Effort:** Phase 1 = 3 weeks (this PR). Phase 2 = ~2 weeks (separate PR, deferred).
**Driver:** Founder taste (no user signal yet — instrument before broad rollout, see Phase 2)

---

## Implementation Handoff

This plan is ready to be picked up by an implementing agent or engineer. Key entry points:

**Start here:** Phase 1, Week 1 — decompose `src/common/components/CastRow.tsx` (~1000 lines) into 4 primitives: `Author`, `CastText`, `EmbedSection`, `ReactionBar`. This is the foundation; the new compact list row and the preview-pane render both compose from these primitives. Ship the decomposition with a regression test proving `StandardCastRow` (assembled from primitives) renders identically to today's `CastRow`. Everything else builds on this.

**What's locked (do not re-litigate):**
- All decisions in the "Eng Review Decisions" section below are resolved with explicit reasoning. If you find yourself wanting to revisit one, surface it as a question rather than silently changing direction.
- Phase 2 (Workspace unification, app-wide hotkey scope cleanup, PostHog instrumentation) is explicitly out of scope for this PR.
- No carousel anywhere. No new tabs for embeds. No legacy toggle.

**What's open (you'll need to make these calls during implementation):**
- 3 critical gaps in the Failure Modes table — must be addressed before merge
- Existing Playwright pattern in repo (find an `*.spec.ts` and follow its setup)
- Tailwind `lg` breakpoint behavior on resize-across-boundary mid-session

**How to verify before declaring "done":**
- All regression-critical tests in the Test Plan section pass
- Manual smoke: j/k flow, Tab focus toggle, Frame v2 in preview, mobile fallback below 1024px, `/cast/0x...` deep link
- Visual: divider drag snaps to 30/70, 50/50, 70/30
- No layout shift when OG metadata loads (reserved aspect ratios)

**Ship gate:**
- All Phase 1 weeks complete
- Critical gaps closed
- Regression tests green
- PR description references this plan and the Eng Review Decisions section

---

## Problem Statement

The current single-column /feeds layout renders all cast embeds inline at full size, immediately, with no lazy gating. This works for text casts but breaks for:

- Frame v2 / mini apps (jarring 400-600px interactive widgets in a skim flow)
- Videos (large players that interrupt vertical rhythm)
- Multiple-embed casts (carousel UX is poor; users dislike it)
- OG metadata (300ms reflow when async fetch completes — `EmbedCarousel.tsx:59-83`)

Two distinct user intents collide in one surface: **fast keyboard skim** (text-dense, j/k flow) vs **lazy interactive browse** (Frames, mini apps, videos). The single column is the architecture of indecision.

## Strategic Direction

Identity bet: **herocast is the one place users do everything Farcaster** — including Frames v2, mini apps, video. Embeds need a real home, not demotion. We are not ceding interactive content to Warpcast.

The fix is layout, not mode-switching. Split-pane separates skim (list) from browse+interact (preview), aligning with users' natural two-intent behavior. Keyboard-first stays primary; the model adapts.

---

## Layout Architecture

```
+----------+--------------------+------------------------------------+
|          |                    |                                    |
|  Left    |   List pane        |   Preview pane                     |
|  rail    |   (compact rows)   |   (cast + embeds expanded)         |
|  w-40    |                    |                                    |
|  fixed   |   ~40% (default)   |   ~60% (default)                   |
|          |                    |                                    |
|  Feed    |                    |                                    |
|  selector|                    |                                    |
|  + lists |                    |                                    |
|  + chans |                    |                                    |
|          |                    |                                    |
+----------+--------------------+------------------------------------+
```

- **Left rail** stays as today (`src/home/index.tsx:478` — `lg:fixed lg:w-40`). Selector items get richer (icons, unread counts).
- **List pane**: compact two-line dense rows.
- **Preview pane**: selected cast with all embeds rendered properly.
- **Resizable** with snap points at 30/70, 50/50, 70/30. Default 40/60. Drag handle on the divider.
- **Below `lg` breakpoint**: collapses to single-column with tap-to-thread (today's mobile behavior). Preview pane disappears entirely on mobile.

---

## List Pane Spec

### Row format (two-line dense)

```
[Avatar 32px]  Author Name  @handle              ← line 1: identity
               Cast text truncated to one line   ← line 2: content (loudest)
               2h · /channel                     ← meta row: muted
```

- **Loudest element**: cast text. Author handle smaller and muted above.
- **Meta row**: timestamp · channel/list source. No embed type icons — embed presence not surfaced in list rows; users see embeds in the preview pane.
- **Selected row**: `bg-muted` + 1px left border accent (current treatment kept — `CastRow.tsx:887`).
- **Hover**: subtle bg tint, no border change.
- **No inline embed rendering** in list rows.

### "N new casts ↑" pill

When new casts arrive while user is reading in preview:

- Pill appears at top of list ("3 new casts ↑")
- Click loads them and scrolls to top
- Twitter/Slack model — no auto-merge, no surprise

### Scroll + selection behavior

- `j` / `k` move selection within list when list has focus.
- Preview pane updates live to reflect selected cast.
- Preview scroll resets to top on every selection change.

---

## Preview Pane Spec

### Header

- Author identity (avatar + name + handle + timestamp)
- Channel/list source
- Cast actions row (reply, recast, like, quote — same as `CastRow.tsx:561-615`)

### Body

- Full cast text (no truncation, no `line-clamp-6`)
- Embeds rendered below in **smart-group + stack** layout (see below)

### Multi-embed: smart group + stack

Carousel is explicitly out. Each embed type has an optimal render:

| Embed type | Render |
|---|---|
| Multiple images (2-4) | Single gallery grid widget (2x2 / 1x2 / 1x3) |
| Single image | Full-width image |
| Video | Native HLS player (`VideoEmbed`) |
| Frame v2 / mini app | Each in its own slot, interactive in-pane |
| URL preview | Compact card with thumbnail + title (`OpenGraphImage`) |
| Cast quote | Nested compact CastRow (`CastEmbed`) |
| Tweet | `TweetEmbed` |

Like-with-like grouped, then groups stacked vertically. One preview = one scrollable column. No carousel anywhere.

### Empty preview

Auto-select the first cast on load. Preview is never empty when feed has content. If feed is empty, show feed-empty state in list, preview shows brief instructional text.

### Embed load failure

Skeleton remains during load. On failure, fall back to a clickable URL link with the embed type label. No error toast, no retry button (keep it quiet).

---

## Interaction Model

### Focus regions

Two-region keyboard model. Active region determines what `j` / `k` do.

```
LIST FOCUSED          PREVIEW FOCUSED
─────────────          ───────────────
j/k = move selection   j/k = scroll preview
Tab → preview          Tab → list (or Shift+Tab)
Shift+Right → preview  Shift+Left → list
o/Enter → enter        Esc → list
                       preview focus
```

### Hotkeys

| Key | List focused | Preview focused |
|---|---|---|
| `j` / `↓` | Move selection down | Scroll preview down |
| `k` / `↑` | Move selection up | Scroll preview up |
| `Tab` | Move focus to preview | Move focus back to list |
| `Shift+→` | Move focus to preview | — |
| `Shift+←` | — | Move focus back to list |
| `Esc` | (no-op or close pill) | Return focus to list |
| `o` / `Enter` | Open thread (in preview) | Interact with focused embed |
| `l`, `Shift+R`, `r`, `q` | Reactions on selected cast | Reactions on previewed cast |

### Frame v2 / mini app interaction

Frames render and run inside the preview pane natively. No new tabs. Click-through behavior captured within the preview surface. If a Frame fails to load, fall back to clickable URL.

(Open question for eng review: keyboard interaction *inside* a focused Frame — see Open Questions.)

---

## Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| List | Skeleton rows (n=10, two-line dense shape) | Feed-empty state with action ("Add a list", "Find users") | Inline error pill at top, retry action | Rows render, virtualization active | "N new casts ↑" pill |
| Preview | Skeleton matching cast structure (header + 6 body lines + 1 embed slot) | "Select a cast" hint (only if no cast available) | Same skeleton + small inline error in embed slot | Cast + embeds fully rendered | Cast text rendered, embed shows skeleton until loaded |
| Embed (in preview) | Type-specific skeleton with reserved aspect ratio | — | Skeleton + URL fallback link | Embed interactive | (n/a) |
| Frame v2 | Frame skeleton (reserved height) | — | URL fallback | Interactive Frame | (n/a) |

**Reserve aspect ratios for every embed type.** Eliminates the 300ms reflow currently caused by async OG metadata fetch.

---

## Phased Roadmap

**Phase 1: split-pane /feeds (3 weeks, this PR)**
**Phase 2: Workspace unification + app-wide cleanups (separate PR, ~2 weeks)**

### Phase 1, Week 1: Foundation
- Decompose `CastRow.tsx` (~1000 lines) into primitives: `Author`, `CastText`, `EmbedSection`, `ReactionBar`
- Build `CompactCastRow` (two-line dense, ~88px) and `StandardCastRow` from primitives — preserves existing isEmbed quote behavior
- New split-pane layout in `app/(app)/feeds/page.tsx` using `react-resizable-panels` v4.4.1 (already in deps)
- Resizable divider with snap points (30/70, 50/50, 70/30), default 40/60
- Auto-select first cast on load; selection update → preview content
- Cancel inflight preview embed fetches on selection change (AbortController)
- Reset preview scroll to top on selection change
- Memoize preview chrome (header, action bar) — body rerenders are fine
- **Fix `estimatedItemHeight={400}` → `88`** at `app/(app)/feeds/page.tsx:450` for compact rows. Verify `scrollToIndex` correctness after change.
- Focus model: prop-drilled `isActive` flag toggles between list and preview hotkey activation. `Tab` and `Shift+←/→` switch focus.
- Selection state: page-local `useState` (NO hook extraction yet — Phase 2 forcing function)

### Phase 1, Week 2: Embed quality
- Build `MultiEmbedStack` component (smart-group + stack):
  - Group images into a single gallery widget (1x2, 1x3, 2x2 layouts based on count)
  - Videos stack as `VideoEmbed` instances
  - Frames v2 each get own slot, rendered + interactive via `@farcaster/frame-sdk`
  - URL previews compact `OpenGraphImage` cards
  - Cast quotes nested `CastEmbed`
  - Cover all 11 existing embed types (CastEmbed, VideoEmbed, OpenGraphImage, NftSaleEmbed, OnchainEmbed, NounsBuildEmbed, ParagraphXyzEmbed, SwapEmbed, TweetEmbed, image inline, generic)
- Reserve aspect ratios for every embed type (eliminates 300ms reflow)
- Lazy-load embeds: render only in preview, not in list rows. List shows embed type icons in meta row only.
- Frame v2 / mini app interactive in preview (no new tabs); failed Frame falls back to clickable URL link
- Skeleton + URL fallback on any embed failure
- "N new casts ↑" pill at top of list
- Decommission `EmbedCarousel` keyboard left/right handler (`EmbedCarousel.tsx:111-131`)
- Remove `CastThreadView` route-replace; new `/cast/0x...` route renders preview-only layout (no list visible). Legacy `?castHash=0x...` redirects.

### Phase 1, Week 3: Polish + ship
- Mobile fallback (<lg breakpoint, 1024px): single-column with tap-to-thread (today's behavior preserved as regression-critical)
- Hotkey cheatsheet UI (`?` opens overlay with new model documented)
- Mode/focus indicator (visual cue when keyboard focus is in preview vs list)
- A11y: ARIA region landmarks for list + preview, focus outlines, screen-reader semantics for two-region layout
- Tauri desktop verification (resize behavior, min widths)
- No legacy toggle — split-pane is the new default
- Test plan complete (see Test Plan section below)

### Phase 2 (separate PR, deferred from this scope)
- Rework `src/common/components/Workspace/panels/FeedPanel.tsx` around the shared split-pane primitive
- Workspace becomes "multi-feed + preview" (Tweetdeck-style for power users)
- Extract `useFeedSelection()` hook (or equivalent) when there's a second consumer
- App-wide hotkey scope cleanup: refactor scope architecture to be focus-region-aware across feeds, notifications, search, conversations (currently each page hacks its own version)
- PostHog instrumentation iteration: unified event schema for feed/preview/embed interactions across the app, not just /feeds. Tracked at [hero-org/herocast#706](https://github.com/hero-org/herocast/issues/706).

---

## Risks

1. **Mobile is the silent landmine.** Two-pane on phone doesn't work. Single-column tap-to-thread fallback effectively maintains two layouts. Plan for it Week 4, not Week 1.

2. **Workspace rework is scope-creep risk.** If Week 3 slips, ship Weeks 1-2 without it; Workspace unification becomes a Phase 2 PR. Acceptable fallback.

3. **Founder-taste-driven, no user telemetry.** Inversion: what if users liked inline embeds and we make it worse for them? Mitigate via PostHog instrumentation in Week 4 — log preview-pane time, in-app embed interactions vs new-tab clicks. CLAUDE.md confirms PostHog is wired. ~1 hour of instrumentation, weeks of confidence.

4. **Keyboard model in preview pane has unresolved decisions.** Specifically: when focus is inside a Frame v2, does Tab cycle within the Frame or escape back to list? Frames v2 may not be designed for in-app embedded keyboard interaction. → see Open Questions.

5. **Thread view collision.** `CastThreadView` currently *replaces* the feed (full-page). With split-pane, threading should happen in the preview pane. Means `CastThreadView` becomes preview content, not a route. Migration path needs care.

---

## NOT In Scope

| Item | Why deferred |
|---|---|
| "Browse later" queue for mini apps | User confirmed: in-flow interaction is enough for v1; queue is Phase 2 if usage signals it |
| Type-specific feed surfaces (Snaps feed, Frames launcher) | Same — start with one preview pane, add separate surfaces only if data shows demand |
| Tweetdeck-style multi-feed-side-by-side as default | Lives in Workspace, not /feeds. Power-user feature. |
| Tabs-by-type for multi-embed | Smart-group + stack is the chosen pattern; tabs add complexity without clear win |
| Density modes (1/2/3 hotkey) | Compact list + rich preview replaces the need for density modes |
| Carousel anywhere | Explicitly out — user confirmed carousel UX is bad |

---

## Eng Review Decisions (resolved)

Resolved during /plan-eng-review:

1. **Hotkey scope architecture**: defer app-wide refactor. For Phase 1, use prop-drilled `isActive` flag to gate hotkey activation per region. Phase 2 PR introduces unified focus-region scope architecture across feeds, notifications, search.
2. **Selection state ownership**: keep `selectedCastIdx` page-local in `app/(app)/feeds/page.tsx`. No hook, no store. Extract to `useFeedSelection()` hook in Phase 2 when Workspace needs a second consumer (essential vs accidental complexity — Brooks).
3. **CastThreadView migration**: remove the route-replacing full-page view. New `/cast/0x...` route renders a preview-only layout (single cast, embeds expanded, no list). Legacy `?castHash=0x...` redirects to the new route.
4. **CastRow refactor**: decompose into `Author`, `CastText`, `EmbedSection`, `ReactionBar` primitives. Assemble `CompactCastRow` and `StandardCastRow` from primitives. Bigger upfront refactor but avoids a 1000-line component growing more variants.
5. **Workspace migration timing**: carve to Phase 2 separate PR. Phase 1 = /feeds split-pane only. Lower risk, faster to ship, cleaner scope.
6. **PostHog instrumentation**: defer. File a GitHub issue for app-wide PostHog instrumentation iteration covering /feeds, Workspace, search, profile.
7. **Frame v2 in-pane interaction**: use `@farcaster/frame-sdk v0.0.64` (already in deps). Render Frames inside preview pane; click-through stays in pane. On failure, fall back to URL link.
8. **Resizable panels library**: `react-resizable-panels v4.4.1` (already in deps). Don't roll our own.
9. **Virtualization**: change `estimatedItemHeight={400}` → `88` at `app/(app)/feeds/page.tsx:450`. Verify `scrollToIndex` correctness after change.
10. **Embed fetch coordination**: cancel inflight `OpenGraphImage` / Frame loads on selection change via AbortController to prevent fetch storms during fast j/k.

## Test Plan

### Unit tests (Jest)

Note: today's test suite is utility-focused (`src/common/helpers/__tests__/`). Phase 1 introduces component testing patterns.

| File | Asserts |
|---|---|
| `CompactCastRow.test.tsx` | Renders author + 1-line text + meta row; embed type icons match `cast.embeds`; selected styling applies |
| `StandardCastRow.test.tsx` (regression) | Renders identically to today's CastRow; isEmbed quote-render path preserved |
| `MultiEmbedStack.test.tsx` | Grouping logic: 4 images → 2x2 gallery, 2 images → 1x2, mixed types → stacked groups |
| `EmbedSection.test.tsx` | Type dispatch hits correct renderer for each of 11 embed types |
| `Author.test.tsx`, `CastText.test.tsx`, `ReactionBar.test.tsx` | Each primitive in isolation |
| `feed-pill.test.tsx` | "N new casts ↑" appears when new content arrives; click loads + scrolls to top; doesn't trigger if at top |

### E2E tests (Playwright)

⚠️ **Prerequisite**: Playwright is in `package.json` but no config, no `e2e/` folder, no spec files exist. Setting up Playwright (config + first spec + CI integration) is itself a half-day task that should land BEFORE the E2E specs below are written. Decision needed: bundle Playwright setup into Phase 1 Week 3 (polish), or defer E2E specs to Phase 2 and rely on manual verification + Jest unit tests for Phase 1.

Recommended: bundle setup into Phase 1 Week 3 so the new layout has E2E coverage before merge. Until then, agents implementing Weeks 1-2 use lint + build + manual smoke as their verification gate.

### E2E specs (after Playwright config exists)

| File | Asserts |
|---|---|
| `feeds-split-pane.spec.ts` | j/k through 20 casts updates preview each time; Tab toggles focus; Shift+Tab returns; click row updates preview |
| `feeds-embed-interaction.spec.ts` | Image embed in preview; multi-image gallery (no carousel); Frame v2 renders + interacts in pane; failed embed → URL fallback link |
| `feeds-resize.spec.ts` | Drag divider snaps to 30/70 / 50/50 / 70/30; resize during read preserves preview scroll |
| `feeds-mobile.spec.ts` (regression) | Below `lg` breakpoint single-column collapse; tap-row-opens-thread regression preserved; hotkeys disabled on mobile |
| `cast-deep-link.spec.ts` (regression) | `/cast/0x...` renders preview-only mode; legacy `?castHash=0x...` redirects to new route |

### Regression-critical (must exist before merge)

- Existing `j` / `k` / `o` / `Shift+O` hotkeys still work in compact list
- Existing reaction hotkeys (`l`, `Shift+R`, `r`, `q`, `x`) still work on selected cast
- Existing mobile tap-to-thread behavior preserved below `lg`
- Existing `?castHash=0x...` deep-link still resolves (or redirects cleanly)
- isEmbed quote-render path still works (CastEmbed inside cast text)

## Failure Modes

| Codepath | Failure mode | Rescued? | Test? | User sees | Logged? |
|---|---|---|---|---|---|
| Selection change → preview render | Selected cast was deleted from feed (e.g., race with refresh) | **GAP** | GAP | Empty preview (or stale) | No |
| Frame v2 in preview | SDK throws / Frame returns invalid response | Falls back to URL link | GAP | Clickable URL | No (should log) |
| Embed fetch during fast j/k | Race: response arrives after selection moved | Should be cancelled (AbortController) | GAP | None (silent) | No |
| MultiEmbedStack | Cast has unknown embed type | Falls through to OpenGraphImage | Need test | URL preview card | No |
| Resize divider | User drags below min width | react-resizable-panels handles | Need verification | Snaps to min | No |
| Mobile breakpoint | Window resized across `lg` boundary mid-session | **GAP** | GAP | Layout switches; selection may be lost | No |
| New-content pill | New cast arrives while user at scroll position 100, presses pill | Auto-scrolls to top | Need test | List jumps to top, new casts visible | No |

**Critical gaps flagged for resolution before merge:**
1. Selected cast deletion during refresh (need fallback to first available)
2. Mobile breakpoint mid-session resize (preserve selection across layout switch)
3. AbortController on embed fetches during selection changes

---

## References (codebase)

- `src/home/index.tsx:478` — main flex layout, requires `flex-1`
- `app/(app)/feeds/page.tsx:438-461` — current feed implementation
- `src/common/components/SelectableListWithHotkeys.tsx:94-150` — keyboard nav core
- `src/common/components/CastRow.tsx:880-994` — current cast row layout
- `src/common/components/Embeds/index.tsx:31-59` — embed type detection
- `src/common/components/Embeds/EmbedCarousel.tsx` — current carousel (to be replaced by smart-group + stack)
- `src/common/components/Workspace/panels/FeedPanel.tsx` — Workspace panel system (target of Week 3 rework)
- `src/stores/useNavigationStore` — modal/UI state
- `src/common/constants/layout.ts` — layout spacing constants
- `docs/plans/embed-loading-states-plan.md` — prior embed loading work, foundational
- `docs/ux-guidelines.md`, `docs/ux-patterns-research.md` — existing UX docs (review for token alignment)

---

## Decisions Log

Captured from CEO review + design review sessions:

**Strategy (CEO review):**
- Identity: full Farcaster client, embeds get a real home
- Mode: SELECTIVE EXPANSION confirmed, with multi-week investment chosen by user
- Direction: split-pane (Approach B from CEO review)

**Layout (Design review Round 1):**
- Two-line dense list rows (author + 1 line text + meta row)
- Default 40/60 split, resizable with snap points 30/70, 50/50, 70/30
- Tab toggles focus between list and preview
- Preview always reflects selected cast (scroll resets on selection change)

**States + edges (Design review Round 2):**
- Auto-select first cast (no empty preview)
- Mobile: single-column tap-to-thread below `lg`
- Frames render and run natively in preview
- `j`/`k` operates within active pane; `Shift+←/→` switches focus regions

**Architecture (Design review Round 3):**
- Feed/channel/list selector stays in left nav rail (richer with icons + unread counts)
- "N new casts ↑" pill at top of list when new content arrives
- Multi-embed needs follow-up (resolved in Round 4)
- Skeleton + URL fallback on embed load failure

**Visual (Design review Round 4):**
- Multi-embed: smart-group + stack (no carousel ever)
- Selection treatment: keep current `bg-muted` + 1px left border
- Hierarchy: cast text loudest, author handle muted above
- Skip mockups now; proceed to /plan-eng-review

---

## Next Steps

1. Run `/plan-eng-review` against this plan to lock architecture before any code.
2. After eng review, optional: generate visual mockups via gstack designer or build HTML wireframe to verify spatial decisions.
3. Begin Week 1 implementation only after eng review clears.
