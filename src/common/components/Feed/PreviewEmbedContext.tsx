'use client';

/**
 * PreviewEmbedContext — opt-in signal for components rendered inside the
 * /feeds preview pane.
 *
 * `EmbedList` (in `CastRow/EmbedSection.tsx`) checks `inPreview` to swap the
 * default carousel for the smart-group `MultiEmbedStack` renderer. Anything
 * outside the preview subtree gets the default value (carousel), so list
 * rows and threaded views are unaffected.
 *
 * Per-selection embed-fetch cancellation is handled by remounting the
 * preview subtree via `key={cast.hash}` (see `PreviewPane`) — react-query
 * auto-aborts on unmount, which covers every metadata fetch in today's
 * embed renderers without an explicit signal needing to be threaded.
 */

import { createContext, useContext } from 'react';

export type PreviewEmbedContextValue = {
  inPreview: boolean;
};

const defaultValue: PreviewEmbedContextValue = {
  inPreview: false,
};

export const PreviewEmbedContext = createContext<PreviewEmbedContextValue>(defaultValue);

export const usePreviewEmbedContext = () => useContext(PreviewEmbedContext);
