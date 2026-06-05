/**
 * Browser-only LiveKit wrapper for Audio Spaces.
 *
 * `livekit-client` is heavy and MUST NOT run on the server, so it is
 * `await import()`-ed INSIDE the methods that need it — never at module
 * top-level (this file is imported by a `"use client"` store but Next still
 * type-checks/bundles it server-side; a top-level import would both bloat the
 * server bundle and break SSR). This also keeps `livekit-client` in its own
 * async chunk, absent from the main bundle (verifiable with the analyzer).
 *
 * Responsibilities (web specifics the RN reference skipped):
 *   - connect(): `new Room()` + `room.connect()`; attach remote AUDIO tracks
 *     to a hidden <audio> element on TrackSubscribed (the web SDK does NOT
 *     auto-play); retry play() (caller invokes connect() inside a click so the
 *     autoplay policy is satisfied).
 *   - disconnect(): detach + stop all audio elements, stop mic, release devices.
 *   - setMicEnabled(): setMicrophoneEnabled(); a getUserMedia denial throws a
 *     typed `MicPermissionError` the store maps to `micError`.
 *   - onActiveSpeakers(): RoomEvent.ActiveSpeakersChanged → FIDs via
 *     `fidFromIdentity`.
 *   - onConnStateChange(): Connected / Reconnecting / Disconnected → SpaceConnState.
 *   - onClosed(): terminal disconnect (e.g. LiveKit token expiry) → the store
 *     decides whether to re-mint via /join and reconnect, or leave.
 */

import { fidFromIdentity, type SpaceConnState } from '@/common/types/spaces';

/** Thrown when the browser blocks/denies microphone access. The store maps
 *  `.name === 'MicPermissionError'` to a user-facing `micError`. */
export class MicPermissionError extends Error {
  constructor(message = 'Microphone permission denied') {
    super(message);
    this.name = 'MicPermissionError';
  }
}

export interface LiveKitRoomHandle {
  /** Connect to the SFU and start playing remote audio. Call inside a user
   *  gesture (the Join click) so autoplay is permitted. */
  connect(wsUrl: string, token: string): Promise<void>;
  /** Detach tracks, stop mic, release devices, leave the room. */
  disconnect(): Promise<void>;
  /** Publish/unpublish the mic. Throws `MicPermissionError` on getUserMedia denial. */
  setMicEnabled(enabled: boolean): Promise<void>;
  isMicEnabled(): boolean;
  /** RoomEvent.ActiveSpeakersChanged → speaking FIDs. */
  onActiveSpeakers(cb: (fids: number[]) => void): void;
  /** Connected / Reconnecting / Disconnected → SpaceConnState. */
  onConnStateChange(cb: (s: SpaceConnState) => void): void;
  /** Terminal disconnect (token expiry / kicked) — store rejoins or leaves. */
  onClosed(cb: () => void): void;
}

/**
 * Create a LiveKit room handle. Pure factory — no SDK import happens until
 * `connect()` is called, keeping the server bundle and SSR path clean.
 */
export function createLiveKitRoom(): LiveKitRoomHandle {
  // Loosely typed because the concrete `Room` type only exists after the
  // dynamic import; we keep `livekit-client` out of the module's type graph.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let room: any = null;
  let micEnabled = false;
  let closed = false;

  // Hidden <audio> elements per remote track sid, so we can detach precisely.
  const audioEls = new Map<string, HTMLAudioElement>();

  // Callbacks registered before connect; wired once the Room exists.
  let activeSpeakersCb: ((fids: number[]) => void) | null = null;
  let connStateCb: ((s: SpaceConnState) => void) | null = null;
  let closedCb: (() => void) | null = null;

  /** Map a livekit ConnectionState string to our SpaceConnState. */
  function mapConnState(state: string): SpaceConnState {
    switch (state) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'reconnecting':
        return 'reconnecting';
      case 'disconnected':
        return 'ended';
      default:
        return 'degraded';
    }
  }

  /** Attach a remote audio track to a hidden, autoplaying <audio> element. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function attachAudio(track: any, sid: string): void {
    if (typeof document === 'undefined') return;
    try {
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      // Audio-only: keep the element out of the layout/AT tree.
      el.style.display = 'none';
      el.setAttribute('data-livekit-audio', sid);
      document.body.appendChild(el);
      audioEls.set(sid, el);
      // The web SDK does not guarantee playback; the Join gesture should allow
      // it, but retry defensively (some browsers still reject the first call).
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay blocked despite the gesture — leave the element in place;
          // a subsequent user interaction (e.g. mic toggle) tends to unblock it.
        });
      }
    } catch {
      /* track attach is best-effort; missing audio is non-fatal to presence */
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function detachAudio(track: any, sid: string): void {
    const el = audioEls.get(sid);
    audioEls.delete(sid);
    try {
      track.detach();
    } catch {
      /* ignore */
    }
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    }
  }

  function detachAllAudio(): void {
    for (const [, el] of audioEls) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
    }
    audioEls.clear();
  }

  return {
    async connect(wsUrl: string, token: string): Promise<void> {
      closed = false;
      const livekit = await import('livekit-client');
      const { Room, RoomEvent, Track } = livekit;

      const r = new Room({
        // Audio-only social rooms: always hear everyone, no adaptive logic.
        adaptiveStream: false,
        dynacast: false,
      });

      r.on(RoomEvent.TrackSubscribed, (track: any, _pub: any) => {
        if (track.kind === Track.Kind.Audio) attachAudio(track, track.sid ?? String(Math.random()));
      });
      r.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        if (track.kind === Track.Kind.Audio) detachAudio(track, track.sid ?? '');
      });

      r.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        if (!activeSpeakersCb) return;
        const fids = speakers.map((s) => fidFromIdentity(s?.identity)).filter((n): n is number => n !== null);
        activeSpeakersCb(fids);
      });

      r.on(RoomEvent.ConnectionStateChanged, (state: any) => {
        connStateCb?.(mapConnState(String(state)));
      });

      r.on(RoomEvent.Disconnected, () => {
        // Terminal: token expired, kicked, or server closed the room. The
        // store decides whether to re-mint a LiveKit token via /join and
        // reconnect (long room) or leave.
        if (closed) return;
        closed = true;
        connStateCb?.('ended');
        closedCb?.();
      });

      await r.connect(wsUrl, token);
      room = r;
      // Resume the AudioContext if the browser created it suspended (the Join
      // click should make this a no-op, but it's cheap insurance).
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await r.startAudio?.();
      } catch {
        /* ignore — playback retry happens per-track on attach */
      }
    },

    async disconnect(): Promise<void> {
      closed = true;
      detachAllAudio();
      const r = room;
      room = null;
      micEnabled = false;
      if (!r) return;
      try {
        // Stop the mic first so getUserMedia devices are released promptly.
        await r.localParticipant?.setMicrophoneEnabled(false);
      } catch {
        /* ignore */
      }
      try {
        await r.disconnect();
      } catch {
        /* ignore */
      }
    },

    async setMicEnabled(enabled: boolean): Promise<void> {
      const r = room;
      if (!r) return;
      try {
        await r.localParticipant.setMicrophoneEnabled(enabled);
        micEnabled = enabled;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Browser getUserMedia denial / no device → typed error for the store.
        if (/notallowed|permission denied|denied by|dismissed|notfound|no.?device|notreadable|in use/i.test(msg)) {
          throw new MicPermissionError(msg);
        }
        throw e;
      }
    },

    isMicEnabled(): boolean {
      return micEnabled;
    },

    onActiveSpeakers(cb: (fids: number[]) => void): void {
      activeSpeakersCb = cb;
    },

    onConnStateChange(cb: (s: SpaceConnState) => void): void {
      connStateCb = cb;
    },

    onClosed(cb: () => void): void {
      closedCb = cb;
    },
  };
}
