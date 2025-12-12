# UX Patterns Research: Linear, Superhuman, and Power User Design

Research compiled for herocast - an open source team learning from the best.

---

## Executive Summary

Linear and Superhuman represent the gold standard for keyboard-first, speed-obsessed productivity software. Their approaches share core principles that are implementable without a dedicated design team:

| Principle          | Linear                                 | Superhuman                           |
| ------------------ | -------------------------------------- | ------------------------------------ |
| **Speed**          | "Blazing fast" as core feature         | 100ms rule for all interactions      |
| **Keyboard-first** | Cmd+K command palette                  | 105+ shortcuts, keystroke pipelining |
| **Opinionated**    | One good way, not infinite flexibility | Deliberate constraints over options  |
| **Craft**          | Trust intuition over A/B tests         | Focus on how software _feels_        |
| **Flow state**     | Linear layout, minimal decisions       | Next action always obvious           |

---

## Part 1: Core Design Principles

### The 100ms Rule (Superhuman)

Every interaction should complete in under 100ms to feel instantaneous. Superhuman actually targets 50ms.

> "Amazon found that every 100ms in latency cost them 1% in sales."

**How to measure:**

- Use `performance.now()` not `new Date()`
- Track % of events under 100ms (not averages)
- Filter measurements when tab is backgrounded
- Discard outliers from sleep/wake cycles

### Opinionated Software (Linear)

> "We design it so that there's one really good way of doing things. Flexible software lets everyone invent their own workflows, which eventually creates chaos as teams scale." — Jori Lallo

**Why this matters for herocast:**

- Don't try to be everything to everyone
- Pick one excellent workflow and execute it perfectly
- Constraints create clarity

### Craft Over Metrics (Both)

> "To design with craft, you must develop and trust your intuition. Yes, you might make wrong choices, but those mistakes become thought experiments." — Karri Saarinen

Neither company relies on A/B testing. They trust designer intuition and ship with conviction.

**For open source teams:** This is actually easier—you don't have growth teams pushing for engagement metrics. Build what feels right.

---

## Part 2: Command Palette (Cmd+K)

### Why Command Palettes Work

1. **Unlimited features** without UI real estate constraints
2. **Flow state** maintenance via keyboard-centric design
3. **Discoverability** through search
4. **Learning tool** showing shortcuts alongside actions

> "Command palettes work because they match how our brains work—we know what we want to do, we just need the computer to keep up."

### Implementation Guidelines

**Universal availability:** Must be accessible everywhere using the same shortcut.

**Search-first:** Users prefer searching to navigating menus. Implement fuzzy matching.

**Teach shortcuts:** Display keyboard shortcuts next to actions. Users internalize them over time.

**Recommended library for herocast:** `cmdk` via shadcn/ui—you already use shadcn, it has fuzzy search, and maximum flexibility.

```bash
npx shadcn-ui@latest add command
```

### What to Include

1. **Navigation** — feeds, channels, lists, settings
2. **Actions** — new post, schedule, switch account
3. **Search** — users, casts, channels
4. **Recent items** — last 5-10 commands
5. **Help** — show all shortcuts

---

## Part 3: Keyboard-First Design

### Superhuman's Approach

- 105+ keyboard shortcuts covering everything
- **Keystroke pipelining:** Commands queue even if UI hasn't caught up
- Mouse disabled during onboarding to force muscle memory

### Linear's Approach

- `?` key opens searchable shortcut help
- Forward slash `/` triggers formatting in editor
- Every common action has a shortcut

### For herocast

**Priority shortcuts to implement:**

- `Cmd+K` — Command palette
- `Cmd+N` — New post
- `J/K` — Navigate feed (vim-style)
- `E` — Engage/like
- `R` — Reply
- `Cmd+Enter` — Submit post
- `Cmd+1-9` — Switch accounts

---

## Part 4: Flow State Design

### The Three Principles (Superhuman)

**1. Make the next action obvious**

> "Hesitation is the flow killer."

- Archive email → immediately see next message (Superhuman)
- NOT: Archive → return to inbox → decide what to do

**For herocast:** After engaging with a cast, auto-advance to next. Don't return to feed list.

**2. Give immediate feedback without distraction**

- Response under 100ms feels instantaneous
- Visual minimalism: "Good design is as little design as possible"
- Eliminate temporal distraction (slow) AND visual distraction (clutter)

**3. Match challenge with skill**

- Don't overwhelm beginners with 105 shortcuts
- Progressive disclosure of advanced features
- Let experienced users access complexity when ready

### Linear Layout Pattern

Content flows in single direction (top-to-bottom, left-to-right):

- No zig-zagging
- Consistently aligned text
- Minimal CTAs
- Reduces cognitive load

---

## Part 5: Speed & Performance

### Optimistic UI

Update UI immediately, sync with server in background.

> "Instead of showing a loading indicator when liking a photo, instantly animate the heart icon while server communication happens in the background." — Instagram

**For herocast:**

- Like/recast: animate immediately
- Post: show in feed immediately, confirm async
- Never show spinners for fast operations

### Animation Guidelines

- Simple feedback (checkbox, toggle): ~100ms duration
- Complex transitions: ~300ms max
- Always 60fps
- Use CSS transforms for GPU acceleration

### Skeleton Screens

For unavoidable delays, use skeleton screens with subtle shimmer animation. Well-designed loading states feel faster even if actually slower.

---

## Part 6: Visual Design

### Dark Mode (Both prioritize this)

Linear: "Black coding environments many engineers prefer, minimizing battery drain and eye strain."

**Implementation:**

- Layered depth model: lighter grays for closer surfaces
- Avoid excessive contrast (causes halation/eye fatigue)
- Adjust each element individually for perceptual contrast
- Use bright colors sparingly as accents

### Color System (Linear's LCH approach)

Linear migrated from HSL to LCH color space:

- Perceptually uniform colors
- Reduced variables from 98 per theme to just 3 (base, accent, contrast)
- Automatically generates consistent themes
- High-contrast accessibility modes built-in

### Typography

Both obsess over typography:

- Linear: Inter Display for headings, Inter for body
- Superhuman: Spent 6 months perfecting typography, modified Adelle Sans

---

## Part 7: Onboarding

### Superhuman's White-Glove Approach

Mandatory 1-on-1 onboarding (30 min per user, 20 FTEs dedicated to this).

> "Like a piano lesson, our customers benefitted from a real human encouraging them to try new interactions."

**Results:** 65%+ conversion vs ~30% without human-led onboarding.

### Synthetic Inbox Innovation

They evolved from using real inbox to synthetic/sample data:

- Safe space to practice without consequences
- Consistent experience
- 20% boost in shortcut usage

**For herocast (without FTEs):**

- Build synthetic onboarding with sample casts
- Full-screen tutorial, not sidebar hints
- Force practice of core shortcuts
- Disable mouse during key learning moments

### Linear's Low-Learning-Curve Approach

> "You shouldn't need a handbook to start using Linear."

- Use universal terms (projects, teams, issues)
- No invented vocabulary
- Reduce cognitive load through simplicity

---

## Part 8: Product-Market Fit Framework

### Superhuman's 40% Benchmark

Survey users: "How would you feel if you could no longer use the product?"

- < 40% "very disappointed" = struggling to find growth
- > 40% = strong traction

**Superhuman's journey:** 22% → 58% by narrowing focus to specific segments (founders, managers, executives) and deliberately ignoring others.

### The Four-Question Survey

1. How would you feel if you could no longer use the product?
2. What type of people would most benefit?
3. What is the main benefit you receive?
4. How can we improve the product for you?

**Minimum sample:** ~40 respondents for directional results.

**Key insight:**

> "Deliberately ignore feedback from users who don't deeply value the core offering, preventing dilution of the product vision."

---

## Part 9: What NOT to Copy

### Without Significant Resources

1. **Manual 1-on-1 onboarding** — Requires 20+ FTEs at scale
2. **Rebuilding Chrome** — Superhuman spent 2 years on this
3. **Invitation-only launch** — Only works with strong brand recognition
4. **Custom typography** — 6 months on fonts is a luxury

### Patterns That Don't Work

1. **Gamification** (points, badges, leaderboards) — Undermines intrinsic motivation
2. **A/B testing everything** — Kills craft and conviction
3. **Infinite flexibility** — Creates chaos at scale
4. **Chasing Linear's visual style** — Now oversaturated, differentiate instead

---

## Part 10: Priority Implementation for herocast

### Phase 1: Quick Wins (Week 1-2)

1. Command palette with cmdk/shadcn
2. Optimistic UI for likes/recasts
3. Measure current performance baseline

### Phase 2: Flow State (Week 3-4)

4. Auto-advance after cast interaction
5. Reduce UI clutter
6. Add shortcuts for 10 most common actions

### Phase 3: Speed (Month 2)

7. Optimize for <100ms interactions
8. Implement skeleton screens
9. Add keystroke pipelining

### Phase 4: Onboarding (Month 3)

10. Synthetic onboarding experience
11. Show shortcuts in command palette
12. Keyboard shortcut practice mode

---

## Key Resources

### Linear

| Resource                           | URL                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| How we redesigned the Linear UI    | https://linear.app/now/how-we-redesigned-the-linear-ui                                    |
| Linear Method                      | https://linear.app/method                                                                 |
| Radix UI Case Study                | https://www.radix-ui.com/primitives/case-studies/linear                                   |
| Inside Linear (Lenny's Newsletter) | https://www.lennysnewsletter.com/p/inside-linear-building-with-taste                      |
| Karri Saarinen's 10 Rules          | https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/ |
| The Linear Method (Figma Blog)     | https://www.figma.com/blog/the-linear-method-opinionated-software/                        |
| Linear design trend analysis       | https://blog.logrocket.com/ux-design/linear-design/                                       |
| Keyboard shortcuts                 | https://shortcuts.design/tools/toolspage-linear/                                          |

### Superhuman

| Resource               | URL                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------- |
| 100ms Rule             | https://blog.superhuman.com/superhuman-is-built-for-speed/                             |
| Performance Metrics    | https://blog.superhuman.com/performance-metrics-for-blazingly-fast-web-apps/           |
| Command Palette Guide  | https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/                 |
| Game Design Principles | https://blog.superhuman.com/game-design-not-gamification/                              |
| Designing for Flow     | https://blog.superhuman.com/how-to-design-for-flow/                                    |
| Dark Theme Design      | https://blog.superhuman.com/how-to-design-delightful-dark-themes/                      |
| PMF Framework          | https://blog.superhuman.com/how-superhuman-built-an-engine-to-find-product-market-fit/ |
| Onboarding Deep Dive   | https://growth.design/case-studies/superhuman-user-onboarding                          |
| Rahul Vohra Interview  | https://www.lennysnewsletter.com/p/superhumans-secret-to-success-rahul-vohra           |

### Command Palette & Modal UX

| Resource                   | URL                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Modal UX Best Practices    | https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/ |
| Command Palette Design     | https://maggieappleton.com/command-bar                                                 |
| Designing Command Palettes | https://solomon.io/designing-command-palettes/                                         |
| cmdk library               | https://github.com/pacocoursey/cmdk                                                    |
| shadcn Command             | https://ui.shadcn.com/docs/components/command                                          |
| Modal Accessibility        | https://www.a11y-collective.com/blog/modal-accessibility/                              |

### General Power User UX

| Resource               | URL                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Dev Tool UI Patterns   | https://evilmartians.com/chronicles/keep-it-together-5-essential-design-patterns-for-dev-tool-uis |
| Keyboard UI Guidelines | https://learn.microsoft.com/en-us/windows/apps/design/input/keyboard-interactions                 |
| UX for Power Users     | https://medly.tech/blog/ux-for-power-users                                                        |

---

## Key Quotes to Remember

> "We design it so that there's one really good way of doing things." — Jori Lallo, Linear

> "Rather than focus on features that users need, we focus on how software makes a user feel." — Rahul Vohra, Superhuman

> "Hesitation is the flow killer." — Superhuman design principle

> "To design with craft, you must develop and trust your intuition." — Karri Saarinen, Linear

> "Every interaction should be faster than 100ms to feel instantaneous." — Paul Buchheit, Gmail creator

> "Good design is as little design as possible." — Dieter Rams (cited by both teams)

---

## Adapting for Open Source

### Advantages we have

- No growth team pushing engagement metrics
- Can be opinionated without board approval
- Community can contribute shortcuts/commands
- Transparency builds trust

### Constraints to work within

- No dedicated design team → lean on design systems (shadcn, Radix)
- No FTEs for onboarding → build synthetic onboarding, video tutorials
- Contributors come and go → document patterns clearly
- Limited QA → ship fast, fix fast, trust users to report

### Our version of "craft"

- Consistent use of existing components
- Keyboard shortcuts for everything
- Performance budgets (measure and enforce)
- One clear way to do each task
- Trust contributor intuition, review for consistency

---

## Part 11: herocast Design Sprint Scope

### Target Screens (3-5)

Based on current feed UI analysis and UX research priorities:

**1. Feed + Cast Cards**

- Current: Clean dark theme, good density, standard engagement actions
- Opportunity: Auto-advance flow, keyboard navigation indicators, optimistic UI feedback
- Reference: Linear's single-direction layout, Superhuman's immediate feedback

**2. Command Palette (Cmd+K)**

- Current: Not implemented
- Opportunity: Universal access to navigation, actions, search, shortcuts
- Reference: Linear/Superhuman command palettes, cmdk library

**3. Right Sidebar (Superhuman-style)**

- Current: Basic
- Opportunity: Contextual info, quick actions, cast details, user preview
- Reference: Superhuman's email detail pane, Linear's issue sidebar
- Ideas:
  - Selected cast expanded view
  - User profile preview on hover/select
  - Thread context
  - Quick reply
  - Related casts

### Current Feed UI Notes

From screenshots (Dec 2024):

**Working well:**

- Clean dark theme
- Good information density
- Channel badges visible
- Quote cast rendering
- Image carousels with prev/next
- Link embeds (arxiv, ufo.fm)
- "Show more" for long content

**Engagement actions visible:**

- Comment, Recast, Like, Share (+ external link icon on some)
- Numbers shown inline

**Potential improvements:**

- Keyboard navigation not visible (no J/K indicators)
- No command palette
- Right sidebar could show more context
- Could add subtle hover states for keyboard selection
- Optimistic UI for engagement actions

### Design System Elements to Define

- Color palette (current dark theme as base)
- Typography scale
- Spacing/density rules
- Component states (hover, active, selected, keyboard-focused)
- Icon style
- Animation timing (100ms for feedback, 300ms for transitions)

---

_Last updated: December 2024_
_Research compiled from Linear, Superhuman, and industry best practices_
