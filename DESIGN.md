# herocast Design System

Source of truth for visual decisions. The design kit lives at
`.context/design-handoff/herocast-design-system/` — this document is the
codebase-local distillation engineers actually read.

> Power user tools for decentralized social. Warm near-monochrome product,
> reserved color, keyboard-first throughout.

## Hard rules

1. **Brand name is lowercase: `herocast`.** Never `Herocast`, never `HeroCast`.
2. **Tokens are the source of truth.** Never inline `#hex`, `rgb(...)`, `hsl(...)`,
   or raw Tailwind palette utilities (`bg-red-500`, `text-blue-400`) in product
   chrome. Resolve through `hsl(var(--token))` or a semantic Tailwind class
   (`bg-primary`, `text-muted-foreground`, `text-mention`, `text-channel`,
   `text-destructive`, `text-success`, `text-warning`, `text-info`). The
   `pnpm check` aggregator includes a `design-tokens` adapter that flags
   leaks — keep that file at zero warnings if you touched it.
3. **Brand-blue (`--mention`) is reserved.** It carries `@mentions`, links, the
   primary chart series, and inbox unread notifications (via `--info`, same
   swatch). Nothing else.
4. **Channels are violet (`--channel`), never blue.** `/channel` references,
   the in-feed channel chip, and the channel highlight in linkified casts all
   use `text-channel` / `bg-channel/10`. This separation lets users tell people
   from venues at a glance.
5. **Type pairing.** Inter for body and UI (`var(--font-sans)`, applied at
   `html`). Satoshi (`var(--font-display)`) is **display only** — the wordmark
   and rare marketing takeover headlines. JetBrains Mono (`var(--font-mono)`)
   for addresses, hashes, FIDs, and kbd glyphs. Don't swap them.
6. **Lucide is the sole icon library.** Stroke 1.5 px (set globally on
   `.lucide`). No emoji or unicode glyphs as icons in product chrome — emoji
   inside a cast body is user content and stays. When you import an icon,
   double-check the Lucide name doesn't shadow `next/image`, `next/link`, or a
   Supabase `User` type (alias to `XxxIcon` if it does).
7. **Buttons carry the herocast signature.** `h-[42px]` default, `rounded-lg`
   (10 px), `font-semibold`. Filled variants use `shadow-button-press` (themed
   for light/dark), outline uses `shadow-button-inset`, and all
   shadow-carrying variants press `translateY(1px)` on `:active`. Don't
   inline `boxShadow` — extend `--shadow-button-*` instead.
8. **Focus ring is a 2 px outline with 2 px offset.** Defined once in
   `src/globals.css` via `:where(...):focus-visible { outline: 2px solid hsl(var(--ring)/0.7); outline-offset: 2px; }`.
   Don't add per-component `focus-visible:ring-*` chains — they suppress the
   global rule.
9. **Motion is fast and quiet.** `--duration-instant: 80ms` (row hover, kbd
   press), `--duration-fast: 150ms` (button press, accordion),
   `--duration-base: 220ms` (dialog, sheet, popover), `--duration-slow: 320ms`
   (full-screen takeover). Easing is `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
   for surfaces and `--ease-in-out` for chrome. No bounces.
10. **Z-index uses tokens.** `--z-dropdown: 30 < --z-popover: 40 < --z-modal: 50 < --z-toast: 60 < --z-tooltip: 70 < --z-command: 80`.
    No magic numbers.

## Token reference

All tokens live in `src/globals.css` (`:root` / `.dark`) and are exposed to
Tailwind via `tailwind.config.js`. See those two files for the canonical list.
Categories:

- **Surfaces & roles**: `--background`, `--foreground`, `--card`, `--popover`,
  `--primary`, `--secondary`, `--muted`, `--accent` (each with `-foreground`).
- **Status**: `--destructive`, `--success`, `--warning`, `--info`, `--pending`.
- **Information accents**: `--mention`, `--channel`, `--hash`.
- **Lines & focus**: `--border`, `--input`, `--ring`.
- **Sidebar family**: `--sidebar-*` (warm cream variants — don't substitute
  the regular surface tokens on sidebar chrome).
- **Marketing**: `--brand-purple`, `--brand-purple-deep` (gradient endpoints
  for paid-plan CTAs and marketing surfaces only).
- **Charts**: `--chart-1..5` (categorical: blue, near-black, violet, green,
  amber).
- **Type scale**: `--text-{xs..6xl}`, `--weight-{regular,medium,semibold,bold}`.
- **Radius**: `--radius-{xs(4), sm(6), md(8), lg(10), xl(12), 2xl(16), full}`.
  Buttons use `lg` (10 px). Cards use `xl` (12 px). Modals use `2xl` (16 px).
- **Density** (opt-in via `<html data-density="compact|comfortable">`):
  `--density-row`, `--density-body`, `--density-avatar`, `--density-pad-{x,y}`.
- **Alpha overlays**: `--alpha-hover` (row/button hover wash),
  `--alpha-mention-fill` (0.08), `--alpha-channel-fill` (0.10),
  `--alpha-highlight` (button inset highlight strength, themed).
- **Shadows**: `--shadow-{xs,sm,(default),md,lg}`, plus button-specific
  `--shadow-button-inset` and `--shadow-button-press`.

## Power-user surfaces

First-class citizens, not optional polish:

- **Command palette** (`⌘K`) — Radix Dialog over backdrop, max-w-640,
  max-h-70vh, sits at `--z-command`. Per-row shortcut hint via the canonical
  `Kbd` / `KbdGroup`.
- **Kbd / KbdGroup** (`src/components/ui/kbd.tsx`) — the single keyboard hint
  renderer. Chord rendering by default (`⌘ K`); pass `sequence` for `g › f`
  ordered shortcuts.
- **Density modes** — three states via `[data-density]`. Tokens are wired;
  a settings toggle is a planned follow-up.

## Voice & content

- **Direct.** Confident, slightly contrarian. Reader is already a power-user
  peer.
- **Sentence case** for buttons, nav, labels (`New draft`, `Scheduled`,
  `Manage`). Title Case is rare and reserved for marketing display headlines.
- **In-product copy is terse.** One- or two-word labels (`Post`, `Feeds`,
  `Channels`, `Search`). Empty states are matter-of-fact, no exclamations, no
  hype words.

## Adding new color or style

1. Check whether an existing semantic token fits. Most "I need a red here"
   moments are `text-destructive`; "I need a green check" is `text-success`.
2. If a new semantic token is needed, add it to **both** `:root` and `.dark`
   in `src/globals.css`, then expose it under `theme.extend.colors` in
   `tailwind.config.js`. Don't ship a token that only exists in one theme.
3. Never reach for a raw Tailwind palette utility (`bg-red-500`) as a quick
   fix. The `design-tokens` adapter flags it on the next `pnpm check`.
4. The `EXEMPT_FILES` set in `scripts/check/adapters/design-tokens.ts` is for
   files where raw color literals are genuinely intentional (PWA manifest,
   external brand SVGs, dev-only panels). Add to it sparingly and document
   the reason on the same line.

## Migrating from the old system

See `.context/design-system-migration-plan.md` for the original ordered
checklist and `.context/design-handoff/herocast-design-system/project/MIGRATION.md`
for the kit's breaking-change list. The migration that landed in
`hellno/design-system-migration` covered tokens, fonts, button signature,
channel-chip violet flip, heroicons→Lucide sweep, focus-ring unification,
sidebar token wiring, CommandPalette tokenization, Kbd consolidation, and
the design-tokens harness. Remaining deliberately deferred:

- Web3 typed-data primitives (`Address`, `Hash`, `Fid`, `Ens`) under
  `src/components/web3/` — pure rendering primitives, not blocking the
  upgrade.
- Density toggle UI in settings — tokens live, surface is planned.
- `?` hotkey overlay — explicitly scoped out.
- Button `lg` size — kept for ~12 hero CTAs that need extra weight; spec
  technically says only `sm` + default.
