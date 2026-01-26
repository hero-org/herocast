/**
 * Mention resolution utilities for Farcaster casts.
 * Handles extracting @mentions from text, resolving usernames to FIDs via Neynar API,
 * and calculating byte positions for the Farcaster protocol.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a resolved mention mapping username to FID.
 */
export interface MentionResolution {
  username: string;
  fid: number;
}

/**
 * Result of processing mentions in text.
 * Contains processed text (with resolved @mentions removed) and arrays of FIDs/positions
 * for the Farcaster protocol.
 */
export interface ResolvedMentions {
  /** The processed text with resolved @mentions removed */
  text: string;
  /** Array of resolved FIDs in order of appearance */
  mentions: number[];
  /** Array of byte positions where each mention starts (the @ symbol position) */
  mentionsPositions: number[];
}

// =============================================================================
// Constants
// =============================================================================

/** Regex pattern to match @mentions in text */
const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g;

/** Farcaster protocol limit for mentions per cast */
const MAX_MENTIONS = 5;

/** Neynar API base URL */
const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

// =============================================================================
// Functions
// =============================================================================

/**
 * Extract @usernames from text.
 * Returns usernames without the @ symbol, in order of appearance.
 *
 * @param text - The text to extract mentions from
 * @returns Array of usernames (without @ prefix) in order of appearance
 *
 * @example
 * extractMentionUsernames("Hello @alice and @bob!")
 * // Returns: ["alice", "bob"]
 */
export function extractMentionUsernames(text: string): string[] {
  const usernames: string[] = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const username = match[1];
    // Avoid duplicates while preserving order
    if (!usernames.includes(username)) {
      usernames.push(username);
    }
  }

  return usernames;
}

/**
 * Resolve usernames to FIDs using the Neynar API.
 * Gracefully handles resolution failures by returning only successful resolutions.
 *
 * @param usernames - Array of usernames to resolve (without @ prefix)
 * @param apiKey - Neynar API key for authentication
 * @returns Array of successful resolutions mapping username to FID
 *
 * @example
 * const resolutions = await resolveMentionFids(["alice", "bob"], "your-api-key");
 * // Returns: [{ username: "alice", fid: 123 }, { username: "bob", fid: 456 }]
 */
export async function resolveMentionFids(usernames: string[], apiKey: string): Promise<MentionResolution[]> {
  if (usernames.length === 0) {
    return [];
  }

  // Limit to max mentions to avoid unnecessary API calls
  const limitedUsernames = usernames.slice(0, MAX_MENTIONS);

  const resolutions = await Promise.all(
    limitedUsernames.map(async (username): Promise<MentionResolution | null> => {
      try {
        const response = await fetch(`${NEYNAR_API_BASE}/user/by_username?username=${encodeURIComponent(username)}`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            api_key: apiKey,
          },
        });

        if (!response.ok) {
          console.warn(
            `[mentions] Failed to resolve username "${username}": ${response.status} ${response.statusText}`
          );
          return null;
        }

        const data = await response.json();

        if (data?.user?.fid) {
          return {
            username: data.user.username || username,
            fid: data.user.fid,
          };
        }

        console.warn(`[mentions] No FID found in response for username "${username}"`);
        return null;
      } catch (err) {
        console.warn(`[mentions] Error resolving username "${username}":`, err);
        return null;
      }
    })
  );

  // Filter out failed resolutions
  return resolutions.filter((r): r is MentionResolution => r !== null);
}

/**
 * Calculate the byte position of a character index in a UTF-8 encoded string.
 * This is necessary because Farcaster uses byte positions, not character positions.
 *
 * @param text - The full text string
 * @param charIndex - The character index to convert
 * @returns The byte position in UTF-8 encoding
 */
function getBytePosition(text: string, charIndex: number): number {
  const encoder = new TextEncoder();
  const prefix = text.substring(0, charIndex);
  return encoder.encode(prefix).length;
}

/**
 * Process mentions in text: extract, resolve to FIDs, and calculate byte positions.
 * This is the main function for preparing cast data for the Farcaster protocol.
 *
 * Key behaviors:
 * - Respects Farcaster's 5 mention limit
 * - Only includes mentions that were successfully resolved
 * - Calculates UTF-8 byte positions (not character positions)
 * - REMOVES resolved @mentions from text (Farcaster protocol requirement)
 * - Gracefully handles resolution failures (unresolved mentions stay as literal text)
 *
 * @param text - The text containing @mentions to process
 * @param apiKey - Neynar API key for username resolution
 * @returns Object containing processed text (with resolved mentions removed) and arrays of FIDs/positions
 *
 * @example
 * const result = await processMentionsInText("Hello @alice!", "your-api-key");
 * // Returns: {
 * //   text: "Hello !",         // @alice removed
 * //   mentions: [123],         // alice's FID
 * //   mentionsPositions: [6]   // byte position where mention was
 * // }
 */
export async function processMentionsInText(text: string, apiKey: string): Promise<ResolvedMentions> {
  // Extract all unique usernames
  const usernames = extractMentionUsernames(text);

  if (usernames.length === 0) {
    return {
      text,
      mentions: [],
      mentionsPositions: [],
    };
  }

  // Resolve usernames to FIDs
  const resolutions = await resolveMentionFids(usernames, apiKey);

  // Create a map for quick lookup
  const fidMap = new Map<string, number>();
  for (const resolution of resolutions) {
    fidMap.set(resolution.username.toLowerCase(), resolution.fid);
  }

  // Process text: remove resolved mentions, keep unresolved ones as literal text
  // Build the result text and track mention positions
  const mentions: number[] = [];
  const mentionsPositions: number[] = [];
  const seenUsernames = new Set<string>();

  let processedText = '';
  let lastIndex = 0;
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const username = match[1].toLowerCase();
    const fid = fidMap.get(username);

    // Add text before this match
    processedText += text.substring(lastIndex, match.index);

    if (fid && !seenUsernames.has(username) && mentions.length < MAX_MENTIONS) {
      // Resolved mention: record position and FID, do NOT add @username to text
      seenUsernames.add(username);
      const encoder = new TextEncoder();
      mentionsPositions.push(encoder.encode(processedText).length);
      mentions.push(fid);
      // Skip the @username - it's removed from text
    } else {
      // Unresolved or duplicate: keep as literal text
      processedText += match[0];
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  processedText += text.substring(lastIndex);

  return {
    text: processedText,
    mentions,
    mentionsPositions,
  };
}
