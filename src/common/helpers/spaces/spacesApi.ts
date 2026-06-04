/**
 * Browser-side client for Farcaster Audio Spaces.
 *
 * Every call hits the SAME-ORIGIN proxy at `${SPACES_PROXY_BASE}/<farcaster-path>`
 * (`app/api/spaces/[...path]`). The proxy authenticates the herocast Supabase
 * session, attaches the per-account Farcaster bearer + the `origin`/`referer`
 * headers a browser cannot set, and forwards to `client.farcaster.xyz`.
 *
 * SECURITY: the Farcaster bearer NEVER reaches this code. We send only the
 * immutable herocast account id (header `x-herocast-account-id`) so the proxy
 * can pick the right server-held bearer. The browser receives only the
 * room-scoped LiveKit token (mapped from raw `result.token` → `liveKitToken`).
 *
 * Failure policy (per spec):
 *   - READS degrade to empty/null on any error (a transient 5xx must not crash
 *     discovery or the in-room poll).
 *   - WRITES throw so the store/UI can toast and keep the user out.
 *
 * NOTE: the Farcaster path strings here mirror
 * `.context/quorum/quorum-mobile/services/spaces/spacesClient.ts` exactly
 * (POST bodies key on `roomId`), but are reached via the proxy base.
 */

import { SPACES_PROXY_BASE } from '@/common/constants/spaces';
import type {
  AudioRoom,
  AudioRoomEnvelope,
  AudioRoomJoinResult,
  AudioRoomParticipant,
  RawAudioRoomJoinResult,
  SpaceRole,
} from '@/common/types/spaces';

/** Header the proxy reads to resolve the per-account Farcaster bearer. */
const ACCOUNT_HEADER = 'x-herocast-account-id';

/** Build the same-origin proxy URL for a Farcaster audio-room path. */
function proxyUrl(farcasterPath: string): string {
  // farcasterPath always starts with `/v1/...`; the proxy mounts it under
  // `/api/spaces` and re-prefixes `client.farcaster.xyz` server-side.
  return `${SPACES_PROXY_BASE}${farcasterPath}`;
}

function logFailure(method: string, path: string, status: number | null, body: string): void {
  const trimmed = body.length > 300 ? `${body.slice(0, 300)}…` : body;
  // eslint-disable-next-line no-console
  console.warn(`[spaces] ${method} ${path} ${status ?? 'network-error'}${trimmed ? ` :: ${trimmed}` : ''}`);
}

async function getJson<T>(accountId: string, farcasterPath: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(proxyUrl(farcasterPath), {
      method: 'GET',
      headers: { accept: 'application/json', [ACCOUNT_HEADER]: accountId },
      // Same-origin: the Supabase session cookie rides along for proxy auth.
      credentials: 'same-origin',
    });
  } catch (e) {
    logFailure('GET', farcasterPath, null, e instanceof Error ? e.message : String(e));
    throw e;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logFailure('GET', farcasterPath, res.status, body);
    throw new Error(`${farcasterPath} ${res.status}: ${body.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(accountId: string, farcasterPath: string, body: unknown = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(proxyUrl(farcasterPath), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        [ACCOUNT_HEADER]: accountId,
      },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
  } catch (e) {
    logFailure('POST', farcasterPath, null, e instanceof Error ? e.message : String(e));
    throw e;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logFailure('POST', farcasterPath, res.status, text);
    throw new Error(`${farcasterPath} ${res.status}: ${text.slice(0, 160)}`);
  }
  // Some writes (leave) return 204/empty; tolerate a non-JSON body.
  return (await res.json().catch(() => ({}))) as T;
}

// ---- Reads (degrade to empty/null) ---------------------------------

/** Currently-live audio rooms (the discovery list). */
export async function fetchLiveRooms(accountId: string, limit = 30): Promise<AudioRoom[]> {
  try {
    const env = await getJson<AudioRoomEnvelope<{ rooms: AudioRoom[] }>>(accountId, `/v1/audio-rooms?limit=${limit}`);
    return env.result?.rooms ?? [];
  } catch {
    return [];
  }
}

/** Upcoming (scheduled) audio rooms. */
export async function fetchScheduledRooms(accountId: string, limit = 30): Promise<AudioRoom[]> {
  try {
    const env = await getJson<AudioRoomEnvelope<{ rooms: AudioRoom[] }>>(
      accountId,
      `/v1/audio-rooms/scheduled?limit=${limit}`
    );
    return env.result?.rooms ?? [];
  } catch {
    return [];
  }
}

/** Single room snapshot (discovery card + in-room poll). */
export async function fetchRoom(accountId: string, roomId: string): Promise<AudioRoom | null> {
  try {
    const env = await getJson<AudioRoomEnvelope<{ room: AudioRoom }>>(
      accountId,
      `/v1/audio-room?roomId=${encodeURIComponent(roomId)}`
    );
    return env.result?.room ?? null;
  } catch {
    return null;
  }
}

/** Participant list for a room. Degrades to empty so the poll never throws. */
export async function fetchParticipants(accountId: string, roomId: string): Promise<AudioRoomParticipant[]> {
  try {
    const env = await getJson<AudioRoomEnvelope<{ participants: AudioRoomParticipant[] }>>(
      accountId,
      `/v1/audio-room/participants?roomId=${encodeURIComponent(roomId)}`
    );
    return env.result?.participants ?? [];
  } catch {
    return [];
  }
}

// ---- Lifecycle writes (throw on failure) ---------------------------

/**
 * Join a room. POST `/v1/audio-room/join` body `{roomId}`.
 * Maps the raw server `result.token` (the LiveKit token) → `liveKitToken`
 * per `AudioRoomJoinResult`. Throws if the proxy/server fails or the payload
 * is missing required fields (so the store keeps the user out).
 */
export async function joinRoom(accountId: string, roomId: string): Promise<AudioRoomJoinResult> {
  const env = await postJson<AudioRoomEnvelope<RawAudioRoomJoinResult>>(accountId, `/v1/audio-room/join`, { roomId });
  const result = env.result;
  if (!result?.wsUrl || !result?.token) {
    throw new Error('audio-room/join: missing wsUrl/token');
  }
  if (!result.room) {
    throw new Error('audio-room/join: missing room payload');
  }
  return {
    wsUrl: result.wsUrl,
    liveKitToken: result.token,
    role: (result.role ?? 'listener') as SpaceRole,
    room: result.room,
    viewerFid: result.viewerFid,
  };
}

/** Leave a room. POST `/v1/audio-room/leave` body `{roomId}`. */
export async function leaveRoom(accountId: string, roomId: string): Promise<void> {
  await postJson(accountId, `/v1/audio-room/leave`, { roomId });
}

/**
 * Best-effort leave for `pagehide`/`beforeunload`. Uses `navigator.sendBeacon`
 * against the SAME-ORIGIN proxy (the Supabase session cookie rides along; the
 * proxy attaches the Farcaster auth). We embed the account id in the body
 * because `sendBeacon` cannot set custom headers.
 *
 * Do NOT rely on this — the server-side heartbeat TTL (~60s) is the real
 * cleanup. This just shortens the window for the common tab-close.
 */
export function leaveRoomBeacon(accountId: string, roomId: string): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  try {
    const blob = new Blob([JSON.stringify({ roomId, accountId })], { type: 'application/json' });
    navigator.sendBeacon(proxyUrl(`/v1/audio-room/leave`), blob);
  } catch {
    /* best-effort only */
  }
}

/**
 * Heartbeat to hold our seat. POST `/v1/audio-room/heartbeat` body
 * `{roomId, activeSpeakerFids}`. The active-speaker FIDs let the server drive
 * listener-side speaker rendering. Throws so the store can count consecutive
 * failures and mark `connState='degraded'`.
 */
export async function heartbeatRoom(accountId: string, roomId: string, activeSpeakerFids: number[]): Promise<void> {
  await postJson(accountId, `/v1/audio-room/heartbeat`, { roomId, activeSpeakerFids });
}

// ---- Host writes (return room or null) -----------------------------

/** Create a new (immediate, live) audio room. POST `/v1/audio-rooms`. */
export async function createRoom(
  accountId: string,
  fields: { title: string; description?: string; channelKey?: string }
): Promise<AudioRoom | null> {
  try {
    const env = await postJson<AudioRoomEnvelope<{ room: AudioRoom }>>(accountId, `/v1/audio-rooms`, fields);
    return env.result?.room ?? null;
  } catch {
    return null;
  }
}

/** Host-only: start a previously-scheduled room. POST `/v1/audio-room/start-scheduled`. */
export async function startScheduledRoom(accountId: string, roomId: string): Promise<AudioRoom | null> {
  try {
    const env = await postJson<AudioRoomEnvelope<{ room: AudioRoom }>>(accountId, `/v1/audio-room/start-scheduled`, {
      roomId,
    });
    return env.result?.room ?? null;
  } catch {
    return null;
  }
}

/** Host-only: end the room for everyone. POST `/v1/audio-room/end`. */
export async function endRoom(accountId: string, roomId: string): Promise<AudioRoom | null> {
  try {
    const env = await postJson<AudioRoomEnvelope<{ room: AudioRoom }>>(accountId, `/v1/audio-room/end`, { roomId });
    return env.result?.room ?? null;
  } catch {
    return null;
  }
}

/** Host-only: update room metadata. POST `/v1/audio-room/update`. */
export async function updateRoom(
  accountId: string,
  roomId: string,
  fields: { title?: string; description?: string }
): Promise<AudioRoom | null> {
  try {
    const env = await postJson<AudioRoomEnvelope<{ room: AudioRoom }>>(accountId, `/v1/audio-room/update`, {
      roomId,
      ...fields,
    });
    return env.result?.room ?? null;
  } catch {
    return null;
  }
}
