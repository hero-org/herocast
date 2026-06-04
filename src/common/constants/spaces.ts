/**
 * Farcaster Audio Spaces — constants and feature flag.
 * See `specs/audio-spaces.md`.
 */

/**
 * Master feature flag. ON by default — set `NEXT_PUBLIC_ENABLE_SPACES=false`
 * to kill the feature. Gates the nav tab, the global live bar, the `/spaces`
 * route, and the `/api/spaces` proxy (which 404s when disabled).
 */
export const SPACES_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SPACES !== 'false';

/** Farcaster first-party audio-room API. SERVER-SIDE / proxy use only. */
export const FARCASTER_AUDIO_BASE_URL = 'https://client.farcaster.xyz';
/** Reaction fan-out socket (v1.1 only — needs a server-side relay). */
export const FARCASTER_AUDIO_WS_URL = 'wss://ws.farcaster.xyz/stream';

/**
 * Headers the proxy MUST set when calling Farcaster. A browser cannot set
 * Origin/Referer (forbidden header names), which is the core reason the
 * control plane is proxied rather than called from the client.
 */
export const FARCASTER_AUDIO_ORIGIN = 'https://farcaster.xyz';
export const FARCASTER_AUDIO_REFERER = 'https://farcaster.xyz/';

/** Same-origin proxy base the browser talks to. */
export const SPACES_PROXY_BASE = '/api/spaces';

/** Polling + heartbeat cadences (presence is poll+heartbeat, not push). */
export const SPACE_POLL_INTERVAL_MS = 5_000;
export const SPACE_HEARTBEAT_INTERVAL_MS = 10_000;
/** Slower cadences while the tab is hidden (still hold the seat). */
export const SPACE_HEARTBEAT_HIDDEN_MS = 30_000;
export const SPACE_POLL_HIDDEN_MS = 15_000;
/** Server GCs a seat after ~this long without a heartbeat; client filters stale. */
export const SPACE_SEAT_TTL_MS = 60_000;
/** Re-mint the Farcaster bearer this many seconds before it expires (server-side). */
export const SPACE_TOKEN_REFRESH_SKEW_S = 60;
/** Default discovery page size. */
export const SPACE_DISCOVERY_LIMIT = 30;

/** Emoji set for v1.1 reactions (kept here so UI + relay agree). */
export const SPACE_REACTION_EMOJIS = ['❤️', '💯', '😂', '🔥', '👏', '🫡'] as const;
