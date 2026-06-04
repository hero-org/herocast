/**
 * Maximum number of users (FIDs) allowed in a FID list
 */
export const MAX_USERS_PER_LIST = 1000;

/**
 * Hard cap on FIDs in a `fids` list. Hypersnap's filter feed accepts at most 100
 * FIDs, so a larger list silently drops the overflow. Mirrors MAX_FID_LIST_SIZE in
 * src/common/constants/listLimits.ts and the DB constraint `list_fids_max_100`.
 */
export const MAX_FID_LIST_SIZE = 100;
