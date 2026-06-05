/**
 * Farcaster Audio Spaces — shared protocol + app types.
 *
 * Protocol shapes mirror Farcaster's first-party audio-room API
 * (reverse-engineered; see `specs/audio-spaces.md` and
 * `.context/quorum/quorum-mobile/services/spaces/spacesClient.ts`).
 *
 * SECURITY: the Farcaster session bearer is NEVER represented here — it
 * lives only in the server-side proxy. The browser receives only the
 * room-scoped LiveKit token (`AudioRoomJoinResult.liveKitToken`).
 */

export type SpaceRole = 'host' | 'cohost' | 'speaker' | 'listener';

export interface SpaceUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: { url?: string };
  /** Some endpoints denormalize the pfp url onto the root; accept both. */
  pfpUrl?: string;
}

export interface PendingStageInvite {
  role: SpaceRole;
  inviterFid: number;
}

export interface AudioRoomParticipant {
  user: SpaceUser;
  role: SpaceRole;
  pendingInvite?: PendingStageInvite | null;
  /** Listener-side: whether this participant has their hand up (v1.1). */
  handRaised?: boolean;
  joinedAt?: string;
}

export interface AudioRoom {
  id: string;
  title?: string;
  description?: string;
  host: SpaceUser;
  state: 'scheduled' | 'live' | 'ended' | (string & {});
  /** ISO timestamp; present once the room is `live`. */
  startedAt?: string;
  /** ISO timestamp; present for `scheduled` rooms. */
  scheduledAt?: string;
  endedAt?: string;
  listenerCount?: number;
  channelKey?: string;
  /** Cast that hosts the space embed; chat = replies to it (v1.1). */
  rootCastHash?: string;
  rootCastFid?: number;
}

/**
 * What the BROWSER receives from the proxied `/join`. The Farcaster
 * bearer is stripped server-side; only the LiveKit room token remains.
 */
export interface AudioRoomJoinResult {
  /** LiveKit signaling URL: `wss://<host>.livekit.cloud`. */
  wsUrl: string;
  /** Short-lived, room-scoped LiveKit token (safe for the client). */
  liveKitToken: string;
  role: SpaceRole;
  room: AudioRoom;
  viewerFid?: number;
}

/**
 * Farcaster's raw `/join` envelope (SERVER-SIDE ONLY, before the proxy
 * strips/renames). `token` is the LiveKit token (safe to forward as
 * `liveKitToken`); nothing else here is sensitive, but treat the source
 * envelope as server-only on principle.
 */
export interface RawAudioRoomJoinResult {
  wsUrl: string;
  token: string;
  role: SpaceRole;
  room: AudioRoom;
  viewerFid?: number;
}

export type SpaceConnState = 'idle' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'ended';

/** Active in-room session held in `useSpacesStore` (memory-only). */
export interface SpaceSession {
  room: AudioRoom;
  role: SpaceRole;
  /** Immutable herocast account id — the token-scope key. */
  accountId: string;
  /** FID of the account that owns this session. */
  accountFid: number;
  connState: SpaceConnState;
  participants: AudioRoomParticipant[];
  /** FIDs currently speaking (from LiveKit ActiveSpeakersChanged). */
  activeSpeakerFids: number[];
  muted: boolean;
  /** epoch ms when we joined (for stale-seat / UI). */
  joinedAt: number;
}

/** Standard Farcaster audio-room response envelope. */
export interface AudioRoomEnvelope<T> {
  result: T;
}

export const canPublish = (role: SpaceRole): boolean => role === 'host' || role === 'cohost' || role === 'speaker';

export const isHostRole = (role: SpaceRole): boolean => role === 'host' || role === 'cohost';

/** LiveKit participant identities are `fid:<n>`. */
export function fidFromIdentity(identity: string | undefined | null): number | null {
  if (!identity) return null;
  const m = /^fid:(\d+)$/.exec(identity);
  return m ? Number(m[1]) : null;
}
