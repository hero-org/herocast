# herocast UX Guidelines

A practical reference for contributors. Values translated into design decisions.

---

## Core Principle

**Power users getting shit done on decentralized social.**

Every design decision should pass this test: Does it help users accomplish their goals faster, with less friction, while respecting their autonomy?

---

## Values → UX Patterns

### 1. "No algorithms. You own your data."

**What this means for UX:**

- Show content chronologically by default
- No infinite scroll tricks to maximize engagement
- No "you might like" interruptions in the feed
- Users choose what they see (lists, channels, follows)
- Clear indication of why something is shown

**Do:**

- Chronological feeds
- User-controlled filters and lists
- Transparent sorting ("Following", "Trending in /channel")
- Let users hide/mute without guilt mechanics

**Don't:**

- Algorithmic "For You" as default
- Engagement bait ("You haven't posted in 3 days!")
- Dark patterns to increase time-on-app
- Notifications designed to create anxiety

---

### 2. "Ship fast. Speed over perfection."

**What this means for UX:**

- Performance is a feature, not a nice-to-have
- Every interaction under 100ms feels instant
- Optimistic UI—show success immediately, sync in background
- Keyboard shortcuts for everything

**Do:**

- Optimistic updates (like → animate immediately)
- Skeleton screens for unavoidable loading
- Measure and enforce performance budgets
- Ship incremental improvements

**Don't:**

- Spinners for fast operations
- Block UI waiting for server confirmation
- Over-engineer before validating with users
- Delay shipping for pixel perfection

---

### 3. "Respect user sovereignty."

**What this means for UX:**

- Users control their experience
- No manipulation of attention
- No gambling mechanics (variable rewards, streaks)
- Keyboard-first for power users, mouse works too

**Do:**

- Consistent, predictable behavior
- User preferences that persist
- Clear feedback on actions taken
- Undo for destructive actions

**Don't:**

- Pull-to-refresh dopamine hits
- Streak counters or loss aversion
- Hidden settings or buried options
- "Are you sure?" for non-destructive actions

---

### 4. "Default open."

**What this means for UX:**

- Design decisions should be explainable
- Contributors can understand and extend patterns
- Consistent use of existing components
- Documentation over tribal knowledge

**Do:**

- Use shadcn/ui components as base
- Follow established patterns in codebase
- Comment non-obvious UX decisions
- Keep design system simple (colors, type, icons, components)

**Don't:**

- Invent new patterns when existing ones work
- Create one-off components
- Hide complexity in clever abstractions
- Assume contributors know the "why"

---

## Keyboard-First Design

herocast is built for people who live in their tools. Keyboard shortcuts aren't optional—they're the primary interface.

### Required Shortcuts

| Action          | Shortcut             | Notes                          |
| --------------- | -------------------- | ------------------------------ |
| Command palette | `Cmd+K`              | Universal access to everything |
| New post        | `Cmd+N`              | Always available               |
| Navigate down   | `J`                  | Vim-style, no modifier         |
| Navigate up     | `K`                  | Vim-style, no modifier         |
| Open/expand     | `Enter` or `O`       | Selected item                  |
| Like            | `L`                  | Quick engagement               |
| Recast          | `R`                  | Opens recast options           |
| Reply           | `C`                  | Comment/reply                  |
| Go back         | `Esc` or `Backspace` | Context-dependent              |
| Submit          | `Cmd+Enter`          | Forms, composer                |
| Switch account  | `Cmd+1-9`            | First 9 accounts               |

### Guidelines

- **Discoverable:** Show shortcuts in tooltips and command palette
- **Consistent:** Same shortcut = same action everywhere
- **Non-destructive by default:** Dangerous actions need confirmation or undo
- **Pipelined:** Queue keystrokes even if UI hasn't caught up

---

## Feed Design

The feed is where users spend 80% of their time. Optimize ruthlessly.

### Flow State Principles

1. **Next action obvious** — After engaging with a cast, show the next one
2. **Immediate feedback** — Likes animate in <100ms
3. **No interruptions** — Don't inject promos or suggestions mid-scroll

### Cast Card Anatomy

```
┌─────────────────────────────────────────────┐
│ [Avatar] Username · @handle · 5h · /channel │
├─────────────────────────────────────────────┤
│ Cast content goes here. Can be multiple     │
│ lines. Truncate with "Show more" if needed. │
├─────────────────────────────────────────────┤
│ [Embed preview if present]                  │
├─────────────────────────────────────────────┤
│ 💬 12   🔄 5   ❤️ 42   ↗️                    │
└─────────────────────────────────────────────┘
```

### States

- **Default:** Standard display
- **Hovered:** Subtle background change
- **Keyboard-selected:** Clear indicator (border or background)
- **Expanded:** Full content, thread context in sidebar

---

## Command Palette

The power user's gateway. Access everything without reaching for the mouse.

### Structure

```
┌─────────────────────────────────────────────┐
│ 🔍 Search commands...                       │
├─────────────────────────────────────────────┤
│ Recent                                      │
│   Go to Following feed              Cmd+1   │
│   New post                          Cmd+N   │
├─────────────────────────────────────────────┤
│ Navigation                                  │
│   Go to feed: Following                     │
│   Go to feed: Trending                      │
│   Go to channel: /farcaster                 │
├─────────────────────────────────────────────┤
│ Actions                                     │
│   New post                          Cmd+N   │
│   Switch account                            │
│   Toggle theme                      Cmd+D   │
└─────────────────────────────────────────────┘
```

### Requirements

- Opens with `Cmd+K` from anywhere
- Fuzzy search (typos forgiven)
- Shows keyboard shortcuts next to actions
- Recent commands at top
- Grouped by category
- Closes on action or `Esc`

---

## Right Sidebar

Contextual information without leaving the feed. Superhuman-style detail pane.

### When Selected Cast

- Full cast content (no truncation)
- Author profile summary
- Thread context (parent cast if reply)
- Quick actions (reply, quote, share)
- Engagement details

### When No Selection

- Current feed info
- Quick account switcher
- Recent activity summary

---

## Component States

Every interactive element needs these states defined:

| State          | Visual Treatment                     |
| -------------- | ------------------------------------ |
| Default        | Base appearance                      |
| Hover          | Subtle background/opacity change     |
| Keyboard focus | Clear ring or border (accessibility) |
| Active/pressed | Slight scale or color shift          |
| Selected       | Persistent highlight                 |
| Disabled       | Reduced opacity, no pointer          |
| Loading        | Skeleton or subtle pulse             |

---

## Animation Timing

Based on Superhuman research:

| Type             | Duration  | Use                        |
| ---------------- | --------- | -------------------------- |
| Micro-feedback   | 100ms     | Button press, toggle, like |
| Transitions      | 200-300ms | Modal open, sidebar slide  |
| Page transitions | 300ms max | Route changes              |

**Rules:**

- Use CSS transforms for GPU acceleration
- 60fps minimum
- No animation > 300ms (feels sluggish)
- Respect `prefers-reduced-motion`

---

## Dark Mode

herocast defaults to dark mode. Engineers and power users prefer it.

### Color Principles

- **Layered depth:** Lighter grays = closer to user
- **Careful contrast:** Avoid pure white on pure black (causes halation)
- **Accent sparingly:** Bright colors for actions, not decoration

### Implementation

```css
/* Example depth layers */
--background: #0a0a0a; /* Deepest */
--surface-1: #141414; /* Cards */
--surface-2: #1a1a1a; /* Elevated */
--surface-3: #242424; /* Hover states */

/* Text with reduced eye strain */
--text-primary: rgba(255, 255, 255, 0.87);
--text-secondary: rgba(255, 255, 255, 0.6);
--text-tertiary: rgba(255, 255, 255, 0.38);
```

---

## Accessibility

Non-negotiable baseline:

- [ ] Keyboard navigable (all interactive elements)
- [ ] Focus indicators visible
- [ ] Color contrast 4.5:1 minimum (text)
- [ ] Screen reader labels on icons
- [ ] No information conveyed by color alone
- [ ] Respects system preferences (dark mode, reduced motion)

---

## Anti-Patterns to Avoid

Things that conflict with herocast values:

| Pattern                              | Why it's bad                    | Alternative                              |
| ------------------------------------ | ------------------------------- | ---------------------------------------- |
| Infinite scroll without end          | Encourages mindless consumption | Pagination or "load more" with clear end |
| Notification badges that don't clear | Creates anxiety                 | Clear on view, or let users disable      |
| "X people are typing"                | FOMO mechanics                  | Show when relevant (DMs), not feeds      |
| Streak counters                      | Gambling psychology             | No streaks, period                       |
| "Come back tomorrow"                 | Manipulative retention          | Users choose when to return              |
| Confetti/celebration animations      | Dopamine manipulation           | Subtle confirmation is enough            |
| "Share to unlock"                    | Growth hacking over UX          | Features available to all                |

---

## Decision Framework

When unsure about a UX decision, ask:

1. **Does this help users get things done faster?**
2. **Would a power user appreciate this or find it annoying?**
3. **Is this transparent and predictable?**
4. **Does this respect user autonomy?**
5. **Is this the simplest solution that works?**

If "no" to any of these, reconsider.

---

## References

- [UX Patterns Research](./ux-patterns-research.md) — Deep dive on Linear/Superhuman patterns
- [CLAUDE.md](../CLAUDE.md) — Technical architecture and conventions
- [herocast values](https://paragraph.xyz/@hellno/herocast-values) — Full manifesto

---

_This is a living document. Update as patterns evolve._
