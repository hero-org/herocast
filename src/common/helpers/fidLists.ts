export type FidListMergeResult = {
  /** Existing FIDs plus the deduped new ones, in order. */
  fids: string[];
  displayNames: Record<string, string>;
  /** Number of FIDs actually added after dedupe. */
  addedCount: number;
  /** True when the merged list would exceed `max`. */
  exceedsCap: boolean;
  /** Remaining slots before `max` (never negative). */
  availableSlots: number;
};

/**
 * Merge incoming `(fid, displayName)` entries into an existing FID list, deduped by
 * FID against BOTH the existing list and within the incoming batch — a single Set
 * seeded with the current FIDs collapses "already in the list" and "repeated in this
 * paste" (e.g. a username and its FID resolving to the same account). Counting and
 * capping happen on the real unique total, so a FID is never double-counted toward
 * `max` nor inserted twice. Existing display names are preserved.
 */
export function mergeFidsCapped(
  currentFids: string[],
  currentDisplayNames: Record<string, string>,
  incoming: Array<{ fid: string; displayName: string }>,
  max: number
): FidListMergeResult {
  const seen = new Set(currentFids);
  const fids = [...currentFids];
  const displayNames = { ...currentDisplayNames };
  let addedCount = 0;

  for (const { fid, displayName } of incoming) {
    if (seen.has(fid)) continue;
    seen.add(fid);
    fids.push(fid);
    displayNames[fid] = displayName;
    addedCount += 1;
  }

  return {
    fids,
    displayNames,
    addedCount,
    exceedsCap: fids.length > max,
    availableSlots: Math.max(0, max - currentFids.length),
  };
}
