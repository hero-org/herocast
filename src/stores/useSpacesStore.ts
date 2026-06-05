/**
 * useSpacesStore — lifecycle store for Farcaster Audio Spaces.
 *
 * MEMORY-ONLY (no persist): a session is realtime and meaningless across
 * reloads. Exactly ONE active session at a time. Reads the selected herocast
 * account from `useAccountStore` (`accounts[selectedAccountIdx]`: `.id` =
 * accountId, `Number(.platformAccountId)` = accountFid) and keys every
 * in-flight request to `session.accountId` so a mid-session account switch
 * can drop stale results and auto-leave cleanly.
 *
 * Presence is poll + heartbeat (not push): we poll `/participants` every
 * `SPACE_POLL_INTERVAL_MS` and heartbeat `/heartbeat` every
 * `SPACE_HEARTBEAT_INTERVAL_MS`, carrying the FIDs we currently hear (from
 * LiveKit ActiveSpeakersChanged). While the tab is hidden we slow both
 * cadences but never let the seat GC. Teardown stops all timers, disconnects
 * LiveKit, releases the mic, fires `/leave` (or `sendBeacon` on pagehide), and
 * removes the pagehide listener.
 *
 * Non-serializable runtime handles (the LiveKit handle, timer ids, listeners,
 * the account-store subscription) live in a module-level `runtime` object —
 * NOT in store state — mirroring the refs the RN reference kept outside React.
 */

'use client';

import { type Draft, create as mutativeCreate } from 'mutative';
import { create } from 'zustand';
import {
  SPACE_DISCOVERY_LIMIT,
  SPACE_HEARTBEAT_HIDDEN_MS,
  SPACE_HEARTBEAT_INTERVAL_MS,
  SPACE_POLL_HIDDEN_MS,
  SPACE_POLL_INTERVAL_MS,
  SPACE_SEAT_TTL_MS,
} from '@/common/constants/spaces';
import { createLiveKitRoom, type LiveKitRoomHandle, MicPermissionError } from '@/common/helpers/spaces/livekitRoom';
import * as spacesApi from '@/common/helpers/spaces/spacesApi';
import {
  type AudioRoom,
  type AudioRoomParticipant,
  canPublish,
  type SpaceConnState,
  type SpaceSession,
} from '@/common/types/spaces';
import { useAccountStore } from '@/stores/useAccountStore';

// ---- Public state/action shape -------------------------------------

interface SpacesState {
  discovery: { live: AudioRoom[]; scheduled: AudioRoom[]; loading: boolean; lastFetch: number | null };
  session: SpaceSession | null;
  /** Bar expanded into the full room view. */
  expanded: boolean;
  micError: string | null;
}

interface SpacesActions {
  refreshDiscovery: () => Promise<void>;
  join: (roomId: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMic: () => Promise<void>;
  setExpanded: (v: boolean) => void;
  createSpace: (fields: { title: string; description?: string; channelKey?: string }) => Promise<AudioRoom | null>;
  startScheduled: (roomId: string) => Promise<void>;
  endSpace: () => Promise<void>;
}

export interface SpacesStore extends SpacesState, SpacesActions {}

// ---- Mutative middleware (matches useNavigationStore) ---------------

const mutative = (config) => (set, get) => config((fn) => set(mutativeCreate(fn)), get);
type StoreSet = (fn: (draft: Draft<SpacesStore>) => void) => void;

// ---- Module-level runtime (non-serializable, off-state) ------------

interface SpacesRuntime {
  livekit: LiveKitRoomHandle | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  /** Whether timers are currently on the hidden (slow) cadence. */
  hidden: boolean;
  /** Consecutive heartbeat failures → degrade after 3. */
  heartbeatFailures: number;
  pagehideListener: ((e?: Event) => void) | null;
  visibilityListener: (() => void) | null;
  accountUnsub: (() => void) | null;
  /** Guards against overlapping join() calls and identifies the live attempt. */
  joinToken: number;
}

const runtime: SpacesRuntime = {
  livekit: null,
  pollTimer: null,
  heartbeatTimer: null,
  hidden: false,
  heartbeatFailures: 0,
  pagehideListener: null,
  visibilityListener: null,
  accountUnsub: null,
  joinToken: 0,
};

// ---- Account identity helpers --------------------------------------

interface AccountIdentity {
  accountId: string;
  accountFid: number;
}

/**
 * Resolve the selected herocast account's identity. Returns null when there is
 * no usable (writable, FID-bearing) account selected — read-only/local
 * accounts have no `platformAccountId` we can act under, and minting is
 * server-side gated anyway.
 */
function getSelectedIdentity(): AccountIdentity | null {
  try {
    const { accounts, selectedAccountIdx } = useAccountStore.getState();
    const account = accounts?.[selectedAccountIdx];
    if (!account?.id || !account.platformAccountId) return null;
    const accountFid = Number(account.platformAccountId);
    if (!Number.isFinite(accountFid) || accountFid <= 0) return null;
    return { accountId: account.id, accountFid };
  } catch {
    return null;
  }
}

/**
 * Guard for an in-flight async result against the current session: returns the
 * live session only if it still exists AND belongs to `accountId`. Any result
 * for a non-current account (switched mid-flight) is dropped by callers seeing
 * `null`. Also re-validates against the still-selected account FID.
 */
function liveSessionFor(get: () => SpacesStore, accountId: string): SpaceSession | null {
  const session = get().session;
  if (!session || session.accountId !== accountId) return null;
  return session;
}

// ---- Stale-seat filter ---------------------------------------------

/**
 * Stale-seat filter. The server GCs unheartbeated seats (~SPACE_SEAT_TTL_MS)
 * and is authoritative on presence, so by default we trust the returned list.
 *
 * The reverse-engineered `AudioRoomParticipant` only carries `joinedAt` (a JOIN
 * time, NOT a last-seen) — filtering on that would wrongly drop long-tenured
 * listeners, so we do not. This hook only filters when a server build surfaces
 * a genuine last-seen field (`lastSeenAt`/`lastHeartbeatAt`); absent that, it
 * is a pass-through. Read defensively so no type change is forced on the
 * shared contract.
 */
function filterStaleSeats(participants: AudioRoomParticipant[]): AudioRoomParticipant[] {
  const now = Date.now();
  return participants.filter((p) => {
    const raw = p as unknown as { lastSeenAt?: string; lastHeartbeatAt?: string };
    const lastSeen = raw.lastSeenAt ?? raw.lastHeartbeatAt;
    if (!lastSeen) return true; // no last-seen signal → trust the server list
    const t = Date.parse(lastSeen);
    if (Number.isNaN(t)) return true;
    return now - t <= SPACE_SEAT_TTL_MS;
  });
}

// ---- Timer / lifecycle helpers (operate via get/set) ---------------

function clearTimers(): void {
  if (runtime.pollTimer) {
    clearInterval(runtime.pollTimer);
    runtime.pollTimer = null;
  }
  if (runtime.heartbeatTimer) {
    clearInterval(runtime.heartbeatTimer);
    runtime.heartbeatTimer = null;
  }
}

/** One participant-poll tick. Drops the result if the session changed. */
async function pollOnce(get: () => SpacesStore, set: StoreSet, accountId: string, roomId: string): Promise<void> {
  if (!liveSessionFor(get, accountId)) return;
  const participants = await spacesApi.fetchParticipants(accountId, roomId);
  // Re-check after the await: switched/left mid-request → drop the stale result.
  if (!liveSessionFor(get, accountId)) return;
  const filtered = filterStaleSeats(participants);
  set((state) => {
    if (!state.session || state.session.accountId !== accountId) return;
    state.session.participants = filtered;
  });
}

/** One heartbeat tick, carrying current activeSpeakerFids. Tracks failures. */
async function heartbeatOnce(get: () => SpacesStore, set: StoreSet, accountId: string, roomId: string): Promise<void> {
  const session = liveSessionFor(get, accountId);
  if (!session) return;
  const fids = session.activeSpeakerFids;
  try {
    await spacesApi.heartbeatRoom(accountId, roomId, fids);
    runtime.heartbeatFailures = 0;
    // Recover from a prior degrade once a heartbeat lands again.
    set((state) => {
      if (state.session?.accountId === accountId && state.session.connState === 'degraded') {
        state.session.connState = 'connected';
      }
    });
  } catch {
    runtime.heartbeatFailures += 1;
    if (runtime.heartbeatFailures >= 3) {
      set((state) => {
        if (state.session?.accountId === accountId) state.session.connState = 'degraded';
      });
    }
  }
}

/** (Re)install poll + heartbeat timers at the cadence for the current visibility. */
function installTimers(get: () => SpacesStore, set: StoreSet, accountId: string, roomId: string): void {
  clearTimers();
  const hidden = runtime.hidden;
  const pollMs = hidden ? SPACE_POLL_HIDDEN_MS : SPACE_POLL_INTERVAL_MS;
  const hbMs = hidden ? SPACE_HEARTBEAT_HIDDEN_MS : SPACE_HEARTBEAT_INTERVAL_MS;
  runtime.pollTimer = setInterval(() => void pollOnce(get, set, accountId, roomId), pollMs);
  runtime.heartbeatTimer = setInterval(() => void heartbeatOnce(get, set, accountId, roomId), hbMs);
}

/** visibilitychange handler: swap cadences and fire an immediate tick on show. */
function makeVisibilityListener(get: () => SpacesStore, set: StoreSet, accountId: string, roomId: string): () => void {
  return () => {
    if (typeof document === 'undefined') return;
    const nowHidden = document.visibilityState === 'hidden';
    if (nowHidden === runtime.hidden) return;
    runtime.hidden = nowHidden;
    // Only re-arm if we still own this session.
    if (!liveSessionFor(get, accountId)) return;
    installTimers(get, set, accountId, roomId);
    if (!nowHidden) {
      // Back to foreground → refresh presence immediately, don't wait a tick.
      void pollOnce(get, set, accountId, roomId);
      void heartbeatOnce(get, set, accountId, roomId);
    }
  };
}

/** pagehide/beforeunload handler: best-effort beacon leave. */
function makePagehideListener(accountId: string, roomId: string): () => void {
  return () => {
    spacesApi.leaveRoomBeacon(accountId, roomId);
  };
}

function removeWindowListeners(): void {
  if (typeof window === 'undefined') return;
  if (runtime.pagehideListener) {
    window.removeEventListener('pagehide', runtime.pagehideListener);
    window.removeEventListener('beforeunload', runtime.pagehideListener);
    runtime.pagehideListener = null;
  }
  if (runtime.visibilityListener) {
    document.removeEventListener('visibilitychange', runtime.visibilityListener);
    runtime.visibilityListener = null;
  }
}

/**
 * Full teardown: stop timers + listeners, disconnect LiveKit, fire server-side
 * `/leave` (best-effort), and clear the session. Idempotent — safe to call when
 * there is no active session (used by `join()` before entering a new room).
 */
async function teardown(get: () => SpacesStore, set: StoreSet, opts: { serverLeave?: boolean } = {}): Promise<void> {
  const session = get().session;
  clearTimers();
  removeWindowListeners();
  runtime.heartbeatFailures = 0;
  runtime.hidden = false;
  runtime.joinToken += 1; // invalidate any in-flight join

  const lk = runtime.livekit;
  runtime.livekit = null;
  if (lk) {
    try {
      await lk.disconnect();
    } catch {
      /* ignore */
    }
  }

  if (opts.serverLeave && session) {
    // Fire-and-forget; the heartbeat TTL is the real cleanup.
    void spacesApi.leaveRoom(session.accountId, session.room.id).catch(() => {});
  }

  set((state) => {
    state.session = null;
    state.expanded = false;
    state.micError = null;
  });
}

/** Subscribe (once) to account switches → auto-leave on a FID change. */
function ensureAccountSubscription(get: () => SpacesStore, set: StoreSet): void {
  if (runtime.accountUnsub || typeof window === 'undefined') return;
  runtime.accountUnsub = useAccountStore.subscribe((accountState) => {
    const session = get().session;
    if (!session) return;
    const account = accountState.accounts?.[accountState.selectedAccountIdx];
    const fid = account?.platformAccountId ? Number(account.platformAccountId) : null;
    // Switched away (different FID, or account gone) while mid-session → leave
    // cleanly. You can't be present under two identities. No toast flag needed
    // here; the UI observes `session` flipping to null.
    if (fid !== session.accountFid) {
      void teardown(get, set, { serverLeave: true });
    }
  });
}

// ---- Store ----------------------------------------------------------

const store = (set: StoreSet, get: () => SpacesStore): SpacesStore => ({
  discovery: { live: [], scheduled: [], loading: false, lastFetch: null },
  session: null,
  expanded: false,
  micError: null,

  refreshDiscovery: async () => {
    const identity = getSelectedIdentity();
    if (!identity) {
      // No writable account → leave discovery empty (read-only accounts can't
      // mint; whether they can browse is a server/proxy concern out of scope).
      set((state) => {
        state.discovery.loading = false;
      });
      return;
    }
    set((state) => {
      state.discovery.loading = true;
    });
    const [live, scheduled] = await Promise.all([
      spacesApi.fetchLiveRooms(identity.accountId, SPACE_DISCOVERY_LIMIT),
      spacesApi.fetchScheduledRooms(identity.accountId, SPACE_DISCOVERY_LIMIT),
    ]);
    // Drop if the account changed during the fetch.
    const current = getSelectedIdentity();
    if (!current || current.accountId !== identity.accountId) {
      set((state) => {
        state.discovery.loading = false;
      });
      return;
    }
    set((state) => {
      state.discovery.live = live;
      state.discovery.scheduled = scheduled;
      state.discovery.loading = false;
      state.discovery.lastFetch = Date.now();
    });
  },

  join: async (roomId: string) => {
    const identity = getSelectedIdentity();
    if (!identity) {
      set((state) => {
        state.micError = null;
      });
      return;
    }
    // If already in a different room (or the same), tear the old one down first
    // so we never strand a ghost participant under the prior identity.
    if (get().session) {
      await teardown(get, set, { serverLeave: true });
    }

    const myToken = ++runtime.joinToken;
    const { accountId, accountFid } = identity;

    // 1) Mint via the proxy /join (throws on failure → user stays out).
    let joinResult;
    try {
      joinResult = await spacesApi.joinRoom(accountId, roomId);
    } catch {
      return; // write failure surfaced via console; UI keeps user out
    }
    // Account switched or a newer join superseded us while minting → abort.
    if (myToken !== runtime.joinToken) return;
    const stillSelected = getSelectedIdentity();
    if (!stillSelected || stillSelected.accountId !== accountId) return;

    // 2) Seed the session.
    const session: SpaceSession = {
      room: joinResult.room,
      role: joinResult.role,
      accountId,
      accountFid,
      connState: 'connecting',
      participants: [],
      activeSpeakerFids: [],
      muted: true,
      joinedAt: Date.now(),
    };
    set((state) => {
      state.session = session;
      state.micError = null;
    });

    // 3) Connect LiveKit and wire events.
    const lk = createLiveKitRoom();
    runtime.livekit = lk;

    lk.onActiveSpeakers((fids) => {
      set((state) => {
        if (state.session?.accountId === accountId) state.session.activeSpeakerFids = fids;
      });
    });
    lk.onConnStateChange((s: SpaceConnState) => {
      set((state) => {
        // Don't clobber a terminal 'ended' (onClosed owns teardown).
        if (state.session?.accountId === accountId && state.session.connState !== 'ended') {
          state.session.connState = s;
        }
      });
    });
    lk.onClosed(() => {
      // Terminal disconnect (e.g. LiveKit token expiry). v1: tear down + leave.
      // A future optimization can re-mint via /join and reconnect here; for v1
      // we leave cleanly so the user is never stuck on dead audio.
      if (runtime.livekit !== lk) return; // superseded
      void teardown(get, set, { serverLeave: true });
    });

    try {
      await lk.connect(joinResult.wsUrl, joinResult.liveKitToken);
    } catch {
      // Connect failed → tear down (server-leave so we don't hold a seat).
      if (runtime.livekit === lk) await teardown(get, set, { serverLeave: true });
      return;
    }
    // Superseded by a newer join while connecting → drop quietly (the
    // superseding attempt owns cleanup).
    if (myToken !== runtime.joinToken || !liveSessionFor(get, accountId)) {
      try {
        await lk.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    // The SELECTED account changed DURING `lk.connect()` — a window the
    // account subscription (installed below) can't catch. Don't go live under
    // the wrong identity: leave the seat we just took and tear down.
    if (getSelectedIdentity()?.accountId !== accountId) {
      if (runtime.livekit === lk) await teardown(get, set, { serverLeave: true });
      return;
    }

    set((state) => {
      if (state.session?.accountId === accountId) state.session.connState = 'connected';
    });

    // 4) Start presence: poll + heartbeat, visibility throttle, pagehide leave.
    runtime.hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    runtime.heartbeatFailures = 0;
    installTimers(get, set, accountId, roomId);
    void pollOnce(get, set, accountId, roomId);
    void heartbeatOnce(get, set, accountId, roomId);

    if (typeof window !== 'undefined') {
      runtime.pagehideListener = makePagehideListener(accountId, roomId);
      window.addEventListener('pagehide', runtime.pagehideListener);
      window.addEventListener('beforeunload', runtime.pagehideListener);
      runtime.visibilityListener = makeVisibilityListener(get, set, accountId, roomId);
      document.addEventListener('visibilitychange', runtime.visibilityListener);
    }
    ensureAccountSubscription(get, set);
  },

  leave: async () => {
    await teardown(get, set, { serverLeave: true });
  },

  toggleMic: async () => {
    const session = get().session;
    const lk = runtime.livekit;
    if (!session || !lk) return;
    if (!canPublish(session.role)) return; // listeners cannot publish
    const next = !lk.isMicEnabled();
    try {
      await lk.setMicEnabled(next);
      set((state) => {
        if (state.session) state.session.muted = !next;
        state.micError = null;
      });
    } catch (e) {
      const message =
        e instanceof MicPermissionError ? e.message : e instanceof Error ? e.message : 'Could not toggle microphone';
      set((state) => {
        state.micError = message;
      });
    }
  },

  setExpanded: (v: boolean) => {
    set((state) => {
      state.expanded = v;
    });
  },

  createSpace: async (fields) => {
    const identity = getSelectedIdentity();
    if (!identity) return null;
    const room = await spacesApi.createRoom(identity.accountId, fields);
    return room;
  },

  startScheduled: async (roomId: string) => {
    const identity = getSelectedIdentity();
    if (!identity) return;
    const updated = await spacesApi.startScheduledRoom(identity.accountId, roomId);
    // If we're already in this scheduled room, reflect the live snapshot.
    if (updated) {
      set((state) => {
        if (state.session?.accountId === identity.accountId && state.session.room.id === roomId) {
          state.session.room = updated;
        }
      });
    }
  },

  endSpace: async () => {
    const session = get().session;
    if (!session) return;
    // Host end, then full teardown. We don't fire an extra /leave — /end already
    // closes the room for everyone including us.
    await spacesApi.endRoom(session.accountId, session.room.id);
    await teardown(get, set, { serverLeave: false });
  },
});

export const useSpacesStore = create<SpacesStore>()(mutative(store));
