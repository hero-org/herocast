/**
 * Reducer-level tests for useSpacesStore.
 *
 * Runs in the `node` jest env (jest.config.js), so `window`/`document` are
 * undefined — the store's pagehide/visibility/account-subscription wiring is
 * skipped, keeping these deterministic and focused on the state machine:
 * join → session, role → canPublish gating, active-speaker merge, drop-stale
 * on account switch, leave teardown, and the stale-seat filter.
 *
 * `spacesApi`, `livekitRoom`, and `useAccountStore` are mocked so no network,
 * no real LiveKit, and no IndexedDB/Supabase import chain is pulled in.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AudioRoom, AudioRoomJoinResult, AudioRoomParticipant, SpaceRole } from '@/common/types/spaces';

// ---- Mocks (declared before the store import) ----------------------
// Each async mock is given a typed implementation so ts-jest infers the right
// return type for later `.mockResolvedValue(...)` / `.mockRejectedValue(...)`.

const mockApi = {
  fetchLiveRooms: jest.fn<(accountId: string, limit?: number) => Promise<AudioRoom[]>>(async () => []),
  fetchScheduledRooms: jest.fn<(accountId: string, limit?: number) => Promise<AudioRoom[]>>(async () => []),
  fetchRoom: jest.fn<(accountId: string, roomId: string) => Promise<AudioRoom | null>>(async () => null),
  fetchParticipants: jest.fn<(accountId: string, roomId: string) => Promise<AudioRoomParticipant[]>>(async () => []),
  joinRoom: jest.fn<(accountId: string, roomId: string) => Promise<AudioRoomJoinResult>>(),
  leaveRoom: jest.fn<(accountId: string, roomId: string) => Promise<void>>(async () => undefined),
  leaveRoomBeacon: jest.fn<(accountId: string, roomId: string) => void>(),
  heartbeatRoom: jest.fn<(accountId: string, roomId: string, fids: number[]) => Promise<void>>(async () => undefined),
  createRoom: jest.fn<(...a: unknown[]) => Promise<AudioRoom | null>>(async () => null),
  startScheduledRoom: jest.fn<(accountId: string, roomId: string) => Promise<AudioRoom | null>>(async () => null),
  endRoom: jest.fn<(accountId: string, roomId: string) => Promise<AudioRoom | null>>(async () => null),
  updateRoom: jest.fn<(...a: unknown[]) => Promise<AudioRoom | null>>(async () => null),
};

const mockLk = {
  connect: jest.fn<(wsUrl: string, token: string) => Promise<void>>(async () => undefined),
  disconnect: jest.fn<() => Promise<void>>(async () => undefined),
  setMicEnabled: jest.fn<(enabled: boolean) => Promise<void>>(async () => undefined),
  isMicEnabled: jest.fn<() => boolean>(() => false),
  onActiveSpeakers: jest.fn<(cb: (fids: number[]) => void) => void>(),
  onConnStateChange: jest.fn<(cb: (s: string) => void) => void>(),
  onClosed: jest.fn<(cb: () => void) => void>(),
};

class MockMicPermissionError extends Error {
  constructor(m = 'denied') {
    super(m);
    this.name = 'MicPermissionError';
  }
}

jest.mock('@/common/helpers/spaces/spacesApi', () => mockApi);
jest.mock('@/common/helpers/spaces/livekitRoom', () => ({
  createLiveKitRoom: () => mockLk,
  MicPermissionError: MockMicPermissionError,
}));

// Mutable account selection the store reads via useAccountStore.getState().
const accountState: { accounts: { id: string; platformAccountId?: string }[]; selectedAccountIdx: number } = {
  accounts: [{ id: 'acct-1', platformAccountId: '111' }],
  selectedAccountIdx: 0,
};

jest.mock('@/stores/useAccountStore', () => ({
  useAccountStore: {
    getState: () => accountState,
    subscribe: () => () => {},
  },
}));

// Import AFTER mocks are registered.
import { useSpacesStore } from '@/stores/useSpacesStore';

function room(id = 'room-1', state: AudioRoom['state'] = 'live'): AudioRoom {
  return { id, title: 'Test', host: { fid: 999 }, state };
}

function joinPayload(role: SpaceRole = 'listener') {
  return { wsUrl: 'wss://x.livekit.cloud', liveKitToken: 'tok', role, room: room(), viewerFid: 111 };
}

function resetStore() {
  useSpacesStore.setState({
    discovery: { live: [], scheduled: [], loading: false, lastFetch: null },
    session: null,
    expanded: false,
    micError: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  accountState.accounts = [{ id: 'acct-1', platformAccountId: '111' }];
  accountState.selectedAccountIdx = 0;
  mockLk.isMicEnabled.mockReturnValue(false);
  mockApi.fetchParticipants.mockResolvedValue([]);
  resetStore();
});

// Tear down any timers/handles the store armed during a join so intervals
// don't leak across tests (the node env runs real setInterval).
afterEach(async () => {
  await useSpacesStore.getState().leave();
});

describe('join', () => {
  it('mints, sets the session with accountId/accountFid, and connects LiveKit', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('listener'));

    await useSpacesStore.getState().join('room-1');

    const session = useSpacesStore.getState().session;
    expect(session).not.toBeNull();
    expect(session?.room.id).toBe('room-1');
    expect(session?.accountId).toBe('acct-1');
    expect(session?.accountFid).toBe(111);
    expect(session?.connState).toBe('connected');
    expect(mockApi.joinRoom).toHaveBeenCalledWith('acct-1', 'room-1');
    expect(mockLk.connect).toHaveBeenCalledWith('wss://x.livekit.cloud', 'tok');
  });

  it('keeps the user out (no session) when the proxy join throws', async () => {
    mockApi.joinRoom.mockRejectedValue(new Error('500'));

    await useSpacesStore.getState().join('room-1');

    expect(useSpacesStore.getState().session).toBeNull();
    expect(mockLk.connect).not.toHaveBeenCalled();
  });

  it('drops the stale mint result if the selected account changed during the join', async () => {
    // Mint resolves but, by then, the user has switched to a different account.
    mockApi.joinRoom.mockImplementation(async () => {
      accountState.accounts = [{ id: 'acct-2', platformAccountId: '222' }];
      return joinPayload('listener');
    });

    await useSpacesStore.getState().join('room-1');

    // Stale-account result must be dropped — no session, no LiveKit connect.
    expect(useSpacesStore.getState().session).toBeNull();
    expect(mockLk.connect).not.toHaveBeenCalled();
  });
});

describe('toggleMic (role gating)', () => {
  it('does nothing for a listener (cannot publish)', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('listener'));
    await useSpacesStore.getState().join('room-1');

    await useSpacesStore.getState().toggleMic();

    expect(mockLk.setMicEnabled).not.toHaveBeenCalled();
    expect(useSpacesStore.getState().session?.muted).toBe(true);
  });

  it('unmutes a host and clears micError', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('host'));
    await useSpacesStore.getState().join('room-1');
    mockLk.isMicEnabled.mockReturnValue(false);

    await useSpacesStore.getState().toggleMic();

    expect(mockLk.setMicEnabled).toHaveBeenCalledWith(true);
    expect(useSpacesStore.getState().session?.muted).toBe(false);
    expect(useSpacesStore.getState().micError).toBeNull();
  });

  it('sets micError on a getUserMedia denial', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('speaker'));
    await useSpacesStore.getState().join('room-1');
    mockLk.isMicEnabled.mockReturnValue(false);
    mockLk.setMicEnabled.mockRejectedValueOnce(new MockMicPermissionError('denied'));

    await useSpacesStore.getState().toggleMic();

    expect(useSpacesStore.getState().micError).toBe('denied');
    expect(useSpacesStore.getState().session?.muted).toBe(true);
  });
});

describe('active speakers → heartbeat payload', () => {
  it('merges LiveKit active speakers into the session for the next heartbeat', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('listener'));
    // Capture the active-speaker callback the store registers on the handle.
    let activeSpeakersCb: ((fids: number[]) => void) | undefined;
    mockLk.onActiveSpeakers.mockImplementation((cb: (fids: number[]) => void) => {
      activeSpeakersCb = cb;
    });

    await useSpacesStore.getState().join('room-1');

    // The immediate heartbeat fired on join carries the FIDs known at that
    // moment ([] — no speakers yet), proving the payload reads
    // session.activeSpeakerFids rather than a hardcoded list.
    expect(mockApi.heartbeatRoom).toHaveBeenCalledWith('acct-1', 'room-1', []);

    // A subsequent ActiveSpeakersChanged event updates the session; the value
    // the next tick will send.
    expect(activeSpeakersCb).toBeDefined();
    activeSpeakersCb!([42, 7]);
    expect(useSpacesStore.getState().session?.activeSpeakerFids).toEqual([42, 7]);
  });
});

describe('leave', () => {
  it('tears down: disconnects LiveKit, fires server leave, clears session', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('listener'));
    await useSpacesStore.getState().join('room-1');
    expect(useSpacesStore.getState().session).not.toBeNull();

    await useSpacesStore.getState().leave();

    expect(mockLk.disconnect).toHaveBeenCalled();
    expect(mockApi.leaveRoom).toHaveBeenCalledWith('acct-1', 'room-1');
    expect(useSpacesStore.getState().session).toBeNull();
    expect(useSpacesStore.getState().expanded).toBe(false);
  });
});

describe('endSpace', () => {
  it('calls host end then tears down without a redundant leave', async () => {
    mockApi.joinRoom.mockResolvedValue(joinPayload('host'));
    await useSpacesStore.getState().join('room-1');

    await useSpacesStore.getState().endSpace();

    expect(mockApi.endRoom).toHaveBeenCalledWith('acct-1', 'room-1');
    expect(mockApi.leaveRoom).not.toHaveBeenCalled(); // /end already closes the room
    expect(useSpacesStore.getState().session).toBeNull();
  });
});

describe('refreshDiscovery', () => {
  it('populates live + scheduled and stamps lastFetch', async () => {
    mockApi.fetchLiveRooms.mockResolvedValue([room('live-1', 'live')]);
    mockApi.fetchScheduledRooms.mockResolvedValue([room('sched-1', 'scheduled')]);

    await useSpacesStore.getState().refreshDiscovery();

    const d = useSpacesStore.getState().discovery;
    expect(d.live.map((r) => r.id)).toEqual(['live-1']);
    expect(d.scheduled.map((r) => r.id)).toEqual(['sched-1']);
    expect(d.loading).toBe(false);
    expect(typeof d.lastFetch).toBe('number');
  });

  it('leaves discovery empty when no writable account is selected', async () => {
    accountState.accounts = [{ id: 'acct-ro' }]; // no platformAccountId → not mintable

    await useSpacesStore.getState().refreshDiscovery();

    expect(mockApi.fetchLiveRooms).not.toHaveBeenCalled();
    expect(useSpacesStore.getState().discovery.live).toEqual([]);
    expect(useSpacesStore.getState().discovery.loading).toBe(false);
  });
});
