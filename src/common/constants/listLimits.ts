/**
 * Maximum number of users that can be added to a single list
 * This limit helps maintain performance and prevents excessively large lists
 */
export const MAX_USERS_PER_LIST = 1000;

/**
 * Hard cap on the number of FIDs allowed in a single FID list.
 * Hypersnap's FID-list feed hard-caps at 100 FIDs, so a list must not exceed
 * 100 members or the feed will silently drop the overflow.
 */
export const MAX_FID_LIST_SIZE = 100;

/**
 * User-facing message shown whenever an action would push a FID list past
 * {@link MAX_FID_LIST_SIZE}.
 */
export const MAX_FID_LIST_SIZE_MESSAGE = 'Lists are limited to 100 accounts';

/**
 * Threshold at which to show a warning that the list is approaching its limit
 * Shows warning when list has 90% or more of the maximum capacity
 */
export const LIST_SIZE_WARNING_THRESHOLD = 900;

/**
 * Maximum number of FIDs that can be sent in a single Neynar API request
 * As per Neynar API documentation: https://docs.neynar.com/reference/fetch-feed
 */
export const NEYNAR_API_MAX_FIDS_PER_REQUEST = 100;
