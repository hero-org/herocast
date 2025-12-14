/**
 * Layout constants for CastRow component and related thread/feed views.
 * Single source of truth for spacing - eliminates magic numbers.
 *
 * Tailwind spacing reference:
 * - 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 7 = 28px, 8 = 32px, 10 = 40px
 */

// Avatar dimensions (Tailwind: h-10 w-10)
export const CAST_AVATAR_SIZE = 40;

// Spacing between avatar and content (Tailwind: gap-x-2)
export const CAST_AVATAR_GAP = 8;

// Container padding (Tailwind: p-3)
export const CAST_CONTENT_PADDING = 12;

// Thread line width (Tailwind: w-0.5)
export const CAST_THREAD_LINE_WIDTH = 2;

// Computed: Avatar center from content edge = padding + avatar/2 = 12 + 20 = 32px
export const CAST_AVATAR_CENTER = CAST_CONTENT_PADDING + CAST_AVATAR_SIZE / 2;

// Computed: Thread line left position (centers under avatar)
// = padding + avatar/2 - lineWidth/2 = 12 + 20 - 1 = 31px
export const CAST_THREAD_LINE_LEFT = CAST_CONTENT_PADDING + CAST_AVATAR_SIZE / 2 - CAST_THREAD_LINE_WIDTH / 2;
