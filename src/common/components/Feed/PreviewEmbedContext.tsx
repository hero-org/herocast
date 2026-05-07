'use client';

/**
 * PreviewEmbedContext — opt-in signal for components rendered inside the
 * /feeds preview pane.
 *
 * Two consumers today:
 *
 * 1. `EmbedList` (in `CastRow/EmbedSection.tsx`) checks `inPreview` to swap
 *    the default carousel for the smart-group `MultiEmbedStack` renderer.
 * 2. Embed leaves that fetch metadata read `abortSignal` and forward it to
 *    `fetch()` so a fast j/k flip cancels stale network calls.
 *
 * Anything outside the preview subtree gets the default value (carousel,
 * no signal), so list rows and threaded views are unaffected.
 */

import { createContext, useContext } from 'react';

export type PreviewEmbedContextValue = {
  inPreview: boolean;
  abortSignal?: AbortSignal;
};

const defaultValue: PreviewEmbedContextValue = {
  inPreview: false,
};

export const PreviewEmbedContext = createContext<PreviewEmbedContextValue>(defaultValue);

export const usePreviewEmbedContext = () => useContext(PreviewEmbedContext);
