# Spec: Audio Spaces (live audio rooms) in herocast — interop with Farcaster's first-party Spaces

**Status:** Draft v2 (post codex adversarial review) · **Author:** (spec via /spec) · **Date:** 2026-06-03 · **Branch:** `hellno/hyderabad`

**One-liner:** Make herocast a full participant in Farcaster's own live audio Spaces — discover, join, listen, host, and speak in the *same rooms* as the first-party Farcaster app — by proxying Farcaster's audio-room control plane through herocast's backend and connecting the browser straight to Farcaster's LiveKit for the audio. No new audio infrastructure, no Farcaster session token in the browser.

## Decision log

- **Strategy = interop** (thin client over Farcaster's backend; same rooms as the first-party app). Accept Farcaster's feature gaps.
- **D1 (revised after codex review): control plane is PROXIED, not direct-from-browser.** Original pick was "hand the short-lived bearer to the browser and call `client.farcaster.xyz` directly." Codex correctly killed this: browser `fetch` forbids setting `Origin`/`Referer` (Quorum sets them, but it's React Native), `Authorization`+JSON forces a CORS preflight, and the Node probe can't prove browser feasibility. So **all `client.farcaster.xyz` calls go through a same-origin `app/api/spaces/*` proxy; the Farcaster bearer never reaches the browser.** Only the room-scoped **LiveKit token** reaches the client (it must, for WebRTC). This also closes the XSS/token-scope risk codex raised. If the Phase 0 CORS probe shows Farcaster allows herocast's origin AND the bearer is provably narrow-scoped, a future optimization MAY call reads directly — not v1.
- **D2 = lean v1** (host + speak + listen core). **Reactions moved from v1 to v1.1** (see Architecture → reactions): live reactions are WebSocket-only and the WS can't ride the request-proxy without putting the bearer in the browser; not worth it for emoji in v1.
- **Auth = server-side mint** in the `farcaster-signer` edge function (Tier 1 app-key JWT). Pending Phase 0 probe.
- Video, recording, clips: out (maybe never).

---

## Context

Farcaster shipped first-party live audio "Spaces" in 2025 (Spaces tab in the app). It's GA but stability-grade and lacks X-Spaces staples (recording, clips, transcripts). herocast — a power-user Farcaster client — has **no audio surface at all**, so a herocast user who wants to join or host a Space must leave for the Farcaster app.

Quilibrium's "Quorum" mobile app proved a third-party client can be a *full* participant in Farcaster Spaces by riding Farcaster's own backend (endpoints reverse-engineered from authenticated traces; cloned to `.context/quorum/quorum-mobile/services/spaces/`). The win we copy is **interop, not feature-extension**: herocast rooms and Farcaster-app rooms are the same rooms. Quorum is React Native, which matters: it sidesteps every browser constraint (CORS, forbidden headers) that this spec must handle.

**Why now:** Spaces is a growing Farcaster surface herocast is absent from; true interop is a real power-user differentiator almost no other client offers, at near-zero infra cost (we ride Farcaster's LiveKit + control plane).

**Stakeholders:** audience users (join/listen, the common case), host/speaker power users (the herocast wedge), engineering (a new realtime vertical that still slots into established herocast patterns: Zustand+mutative store, App Router route + API routes, server-signed identity via `farcaster-signer`).

---

## Current State (verified 2026-06-03)

| Area | Finding | Evidence |
|------|---------|----------|
| Realtime / audio infra | **None.** No WebRTC, websockets, LiveKit/Agora/Daily, Supabase realtime, SSE, presence. | grep across `src/**` |
| "Live" today | Only near-realtime is a 5s polling sync | `useNotificationStore.ts:11` |
| Media playback | Only HLS video (`@gumlet/react-hls-player`, `next/dynamic` `ssr:false`). No `getUserMedia`, no audio-only player. | `src/common/components/Embeds/VideoEmbed.tsx` |
| Identity | FID = `Number(accounts[selectedAccountIdx]?.platformAccountId)` | `useAccountStore.ts:77-80`; `useCastActions.ts:96-98` |
| Write path | Casts/reactions/follows server-signed by the `farcaster-signer` edge fn; client never signs. | `farcaster.ts:79-124`; `supabase/functions/farcaster-signer/` |
| Credentials herocast holds | **Only the Ed25519 signer (app key)** per account. **No custody key, no seed.** The signer is encrypted server-side (`accounts.private_key`, pgsodium) AND mirrored in IndexedDB by the Zustand persist layer (existing behavior). | `useAccountStore.ts:77,80,23`; `lib/sign.ts:106-118`; `decrypted_account` RPC `migrations/20250625101126_remote_schema.sql:5-22` |
| Wallet infra | wagmi v2 + viem + RainbowKit wired; custody-ownership check `getFidForAddress`/`idOf==fid` already used. | `rainbowkit.tsx`, `farcaster.ts:337-347`, `RenameAccountForm.tsx:97-128` |
| Nav | Rendered sidebar = `mainNavItems` (NOT the drifted second list in `home/index.tsx`). | `LeftSidebarNav.tsx:28-75` |
| Global singletons | sonner `<Toaster>` + provider context mounted once in `Home`. | `home/index.tsx:558,:410` |

**Threat-model note (corrected per review):** herocast already mirrors the Ed25519 signer in IndexedDB; that is *existing* exposure, not introduced here. What this spec guarantees is narrower and accurate: **(a)** signer-based token *minting* happens server-side in the edge fn (the signer is never used by spaces code in the browser), and **(b)** the resulting Farcaster *session bearer* never reaches the browser at all (it lives only in the proxy). The browser receives only room-scoped LiveKit tokens.

### Capability landscape

| Capability | Farcaster app | Quorum | herocast today | **v1** | v1.1+ |
|---|---|---|---|---|---|
| Discover live/scheduled rooms | ✅ | ✅ | ❌ | ✅ | — |
| Join / listen / leave | ✅ | ✅ | ❌ | ✅ | — |
| Host: create / start / end | ✅ | ✅ | ❌ | ✅ | — |
| Speak (mic publish as host/speaker) | ✅ | ✅ | ❌ | ✅ | — |
| Participant list + active-speaker | ✅ | ✅ | ❌ | ✅ | — |
| Live emoji reactions (send+receive) | ✅ | ✅ | ❌ | ❌ | ✅ (needs WS relay) |
| In-space chat (cast replies) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Raise-hand queue | ✅ | ✅ | ❌ | ❌ | ✅ |
| Invite/promote/demote (stage mgmt) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Scheduled-room create + RSVP | ✅ | ✅ | ❌ | ❌ | ✅ |
| Recording / clips / video | partial | partial | ❌ | ❌ | ❌ |

---

## Architecture

```
                          herocast (browser, "use client")
  ┌────────────────────────────────────────────────────────────────┐
  │  /spaces page · <LiveSpaceBar> · useSpacesStore                  │
  │     │ same-origin fetch                       │ wsUrl + LiveKit  │
  │     ▼                                          │ room token only │
  └─────┼──────────────────────────────────────────┼────────────────┘
        │ /api/spaces/* (Supabase-session auth)     │
        ▼                                           ▼
  ┌───────────────────────────────┐          *.livekit.cloud
  │ herocast backend              │          (audio SFU — WebRTC media,
  │  app/api/spaces/* proxy       │           browser-native CORS)
  │  + farcaster-signer edge fn   │
  │    mintAudioRoomToken(acct)   │
  └───────────────┬───────────────┘
                  │ Bearer <farcaster session token>  (NEVER leaves the server)
                  │ origin/referer set server-side (allowed off-browser)
                  ▼
        client.farcaster.xyz/v1/audio-room*   (control plane)
```

**Key properties:**
- **We host/pay for nothing.** LiveKit `wsUrl`+`token` are minted by Farcaster's `/join`. Control plane + (later) reactions are Farcaster's.
- **The Farcaster bearer never reaches the browser.** It's minted and held server-side; the proxy attaches it (and the `origin`/`referer` headers a browser can't set). The browser talks only to `/api/spaces/*` (same-origin, no CORS) and to LiveKit.
- **Browser holds only the LiveKit room token** — short-lived and scoped to one room, which is exactly what WebRTC needs and the minimum blast radius under XSS.
- **Reactions (v1.1):** live reactions come over `wss://ws.farcaster.xyz/stream` authenticated with the bearer. A browser WS sends herocast's real `Origin` (unspoofable) and would need the bearer client-side — so v1.1 will add a herocast-side WS relay (browser ↔ herocast ↔ Farcaster) keeping the bearer server-side. Not in v1.

---

## Phase 0 — Feasibility gates (BLOCKING; nothing in Epic A/B starts until all pass)

Run `.context/spaces-probe/probe.mjs` (instructions in `.context/spaces-probe/README.md`). It now tests three things, and the gate needs all three resolved:

1. **Auth (Q1): can we mint a token Farcaster accepts with the signer we already hold?** Tier 1 = app-key Ed25519 JWT, header `{fid,type:"app_key",key}`, payload `{exp:+300}`, Ed25519 over `b64url(header).b64url(payload)`. Mintable server-side, zero user friction. **Gate is strict:** auth passes only on a 200 to an auth-gated read, or a 404 "room not found" to a join with a random roomId. 400/405/429/5xx are **inconclusive, not success** (fixes the false-green).
2. **Browser/CORS (Q2): can a browser at herocast's origin reach the control plane at all?** Since we proxy, the *browser→proxy* hop is same-origin (fine). This check instead confirms the *server→Farcaster* hop and tells us whether a future direct-read optimization is even possible. The probe inspects the CORS preflight (`OPTIONS` with herocast `Origin`).
3. **Tier-2 status.** If Q1 is red (Tier 1 rejected), v1 is **BLOCKED** pending a separate Tier-2 spec — do not hand-wave "re-scope." Tier 2 (custody wallet-signature → `/v2/onboarding-state` → `MK-` token) is a *different* product (client-side wallet connect, eligibility limited to accounts whose custody EOA is in a connectable wallet, server-side encrypted token storage, refresh on 401, and `/v2/onboarding-state` is itself subject to the same proxy requirement). Writing that spec is its own task; flag and stop.

**Gate outcomes:**
- Q1 green → proceed; mint server-side; all writable accounts eligible.
- Q1 red → STOP, write Tier-2 spec, re-decide.
- Q2 is informational for v1 (we proxy regardless); it gates only the future direct-read optimization.

The rest of this spec assumes **Q1 green**.

---

## Implementation Details

### Reference protocol (from `.context/quorum/quorum-mobile/services/spaces/spacesClient.ts`)

Base `https://client.farcaster.xyz`. **Headers are set server-side in the proxy** (a browser can't set `origin`/`referer`):
```
accept: */*
content-type: application/json; charset=utf-8
authorization: Bearer <farcaster session token>   # server-held
origin: https://farcaster.xyz
referer: https://farcaster.xyz/
```
Envelope `{ result: ... }`. POST bodies key on `roomId`.

**v1 endpoints** (every one called via the proxy):

| Method | Path | Body/query | Returns | Role |
|---|---|---|---|---|
| GET | `/v1/audio-rooms?limit=` | — | `{result:{rooms}}` (live) | any |
| GET | `/v1/audio-rooms/scheduled?limit=` | — | `{result:{rooms}}` | any |
| GET | `/v1/audio-room?roomId=` | — | `{result:{room}}` | any |
| GET | `/v1/audio-room/participants?roomId=` | — | `{result:{participants}}` | any |
| POST | `/v1/audio-room/join` | `{roomId}` | `{result:{wsUrl,token,role,room,viewerFid}}` | any |
| POST | `/v1/audio-room/leave` | `{roomId}` | — | any |
| POST | `/v1/audio-room/heartbeat` | `{roomId,activeSpeakerFids}` | — | any |
| POST | `/v1/audio-rooms` | `{title,description?,channelKey?}` | `{result:{room}}` | host |
| POST | `/v1/audio-room/start-scheduled` | `{roomId}` | `{result:{room}}` | host |
| POST | `/v1/audio-room/end` | `{roomId}` | `{result:{room}}` | host |
| POST | `/v1/audio-room/update` | `{roomId,...}` | `{result:{room}}` | host |

Deferred to v1.1: `reaction`, `raise-hand`, `rsvp`, `accept-speaker`, `remove-speaker`, `{accept,decline,cancel}-stage-invite`, `chat`, and the reaction WS.

Types: port `SpaceUser`, `SpaceRole='host'|'cohost'|'speaker'|'listener'`, `AudioRoomParticipant`, `AudioRoom` (note `rootCastHash`, `state`, `listenerCount`, `startedAt`/`scheduledAt`), `AudioRoomJoinResult` from `spacesClient.ts:91-157`.

### LiveKit (web, client-only)
`npm i livekit-client`. **Must only be imported from `"use client"` code via `await import('livekit-client')` inside a browser-only action** (it is NOT a `next/dynamic` component, so `ssr:false` doesn't apply; the rule is: never import it at module top-level in anything that can run on the server). Wrapper `livekitRoom.ts` responsibilities (codex flagged these as missing):
- `connect(wsUrl, token)` → `new Room()`, `room.connect()`.
- **Attach remote audio tracks** on `TrackSubscribed` to a hidden `<audio>` element (`track.attach()`), detach + cleanup on `TrackUnsubscribed`/disconnect. Do not assume "auto-plays."
- **Autoplay/user-gesture:** Join is a user gesture; resume `AudioContext`/retry `audio.play()` on the click. Surface a "tap to enable audio" affordance if the browser blocks playback.
- **Mic publish:** only when role ∈ {host,cohost,speaker}; `setMicrophoneEnabled(true)` (triggers `getUserMedia` prompt); handle denial. Release on leave.
- **Active speakers:** `RoomEvent.ActiveSpeakersChanged`; identities `fid:<n>` (`fidFromIdentity` regex).
- **Reconnect / token expiry:** handle `Disconnected`/`reconnecting`; if the LiveKit token expired (long room), re-call proxied `/join` to mint a fresh LiveKit token and reconnect. Device cleanup on every teardown.
- **Bundle:** verify `livekit-client` is its own async chunk, absent from the main bundle (analyzer), flag-gated.

### New files & touch points

| File | Change |
|---|---|
| `app/api/spaces/[...path]/route.ts` | **New, core.** Same-origin proxy. Authenticates the herocast Supabase session, reads `accountId` (header/query), obtains the per-account Farcaster bearer (calls the edge-fn mint, caches server-side with `expiresAt`, refreshes on expiry/401), forwards GET/POST to `client.farcaster.xyz` with bearer + `origin`/`referer`, returns JSON. `maxDuration=20`. **`/join` responses: strip everything except `{wsUrl, token (LiveKit), role, room, viewerFid}` before returning** — the Farcaster bearer must never be in the response. |
| `supabase/functions/farcaster-signer/handlers/audioRoomToken.ts` | **New.** `mintAudioRoomToken(account_id)` → load signer via `decrypted_account` RPC, build app-key JWT, return `{token, expiresAt, scheme}`. Reuses `lib/sign.ts` Ed25519 + `lib/accounts.ts`. |
| `supabase/functions/farcaster-signer/index.ts` | Route `action:'mintAudioRoomToken'`. |
| `src/common/helpers/spaces/spacesApi.ts` | **New.** Browser client that calls `/api/spaces/*` (same-origin), keyed by `accountId`. Returns typed `AudioRoom`/participants/join results. Read failures degrade to empty; write failures surface. |
| `src/common/helpers/spaces/livekitRoom.ts` | **New.** Client-only LiveKit wrapper (above). |
| `src/stores/useSpacesStore.ts` | **New.** Zustand+mutative, memory-first. State: `discovery` (live/scheduled + lastFetch), `session` (`{room, role, accountId, accountFid, connState, participants, activeSpeakerFids, muted}` \| null), `tokenScope` (LiveKit token only). Actions: `refreshDiscovery`, `join(roomId)`, `leave()`, `toggleMic()`, host `create/start/end/update`, internal `_poll/_heartbeat/_onActiveSpeakers/_onConn`. One active session. **All in-flight requests carry `session.accountId`; any response for a non-current account is dropped.** |
| `app/(app)/spaces/page.tsx` + `loading.tsx` | **New.** Discovery (live grid + scheduled) + "Start a Space". `<PageSkeleton variant="list" />`. |
| `src/common/components/Sidebar/LeftSidebarNav.tsx` | Add `Spaces` to `mainNavItems` (`:28-75`), Lucide `Radio`, `href:'/spaces'`. Only edit that renders the tab. |
| `src/home/index.tsx` | Mount `<LiveSpaceBar />` near `<Toaster>` (`:558`), inside provider context, hidden on `/login` (`:396`). Optional `navigationGroups`/`getSidebarForPathname` entries. |
| `src/common/components/Spaces/{LiveSpaceBar,SpaceRoomView,LiveSpacesStrip}.tsx` | **New.** Persistent store-driven bar (model `PerfPanel.tsx`); expanded room (participant grid, active-speaker rings, mic, host controls); discovery strip. |
| `package.json` | `livekit-client` (async-imported). |
| Feature flag | `NEXT_PUBLIC_ENABLE_SPACES` + `useUserSettingsStore` toggle, default OFF. Also gates the `/api/spaces` proxy (return 404 when off). |

### Lifecycle (precise; supersedes the v1 hand-wave)

**Join:** `spacesApi.join(roomId, accountId)` → proxy mints/uses bearer, POSTs `/join`, returns `{wsUrl, liveKitToken, role, room}` (bearer stripped). Store sets `session` (with `accountId` + `accountFid`). `livekitRoom.connect(wsUrl, liveKitToken)`. Start participant poll + heartbeat (below). Role usually `listener`.

**Heartbeat & presence (reverse-engineered — confirm TTL against a live trace in Phase 0):**
- Every joined client POSTs `/heartbeat` every **10s** to hold its seat; assume server GCs a seat after ~**60s** without heartbeat. (The exact "who must heartbeat" is unconfirmed; default to *all* joined clients heartbeating to be safe.)
- `activeSpeakerFids` payload = FIDs the local client currently hears (from LiveKit `ActiveSpeakersChanged`), so the server can drive active-speaker rendering for listeners without a direct feed.
- Participant list poll every **5s** (`/participants`).
- **Failure:** exponential backoff on heartbeat/poll errors (cap ~30s); 3 consecutive heartbeat failures → mark `connState='degraded'`, surface in the bar.
- **Tab hidden** (`visibilitychange`): keep heartbeat at ≥1 per 30s (never let the seat GC while audio plays); throttle the participant poll to 15s; on visible, immediate poll+heartbeat.

**Token lifecycles (three, independent — codex flagged conflation):**
- *Farcaster bearer* (server-only): proxy refreshes on `exp-60s` or any 401 from Farcaster; transparent to the client.
- *LiveKit room token* (browser): if LiveKit reports expiry/disconnect on a long room, re-call proxied `/join` → fresh token → `livekitRoom` reconnect.
- *(v1.1) reaction WS*: n/a in v1.

**Teardown (best-effort, codex-corrected):** Explicit Leave → proxy `/leave` + stop timers + `livekitRoom.disconnect()` + release mic. On `pagehide`/`beforeunload`, fire a best-effort `/leave` via `navigator.sendBeacon` to the **same-origin proxy** (the proxy attaches auth; `sendBeacon` can't carry our headers cross-origin, but to `/api/spaces` it's same-origin and the Supabase session cookie rides along). **Do not rely on it** — the 60s heartbeat TTL is the real cleanup. Stale-seat UX: a participant with no heartbeat for >60s is filtered from the rendered list client-side.

**Multi-account (codex-corrected; was `accountId`/`accountFid` mismatch):** Tokens are keyed by **immutable herocast `accountId` + its FID**, both server-side (bearer cache) and in the store (`session.accountId`/`accountFid`). Switching the selected account while in a Space **aborts in-flight requests, leaves the Space, and toasts**; you can't be present under two identities. Read-only accounts (`farcaster_local_readonly`) can't mint → **join/host disabled**; whether they can even *browse* discovery depends on the Phase 0 unauth-discovery result (if discovery is auth-gated, read-only accounts see an empty/locked state — no service-token browsing in v1).

---

## Acceptance Criteria

**Phase 0 (gate)**
1. Probe prints an unambiguous AUTH verdict using the strict rule (200-on-gated-read or 404-room-not-found only; never a bare non-401), plus a CORS/preflight readout and the Tier-2 branch if red.

**Discovery & join (v1)**
2. With the flag on, a `Spaces` tab appears and routes to `/spaces`; the page lists live rooms (via the proxy) within 2s or shows loading/empty.
3. A herocast user joins a room **started in the Farcaster app**, hears live audio within 3s of Join (remote tracks attached + autoplay handled), and sees participants + active-speaker update at least every 5s. **No `client.farcaster.xyz` request originates from the browser** (verify in Network tab — only `/api/spaces/*` + `*.livekit.cloud`).
4. Joining sets the persistent `LiveSpaceBar`; navigating any herocast route keeps audio playing + bar visible; tapping re-opens the room; Leave tears down audio+bar within 1s; closing the tab eventually frees the seat (≤~60s via TTL) even if `sendBeacon` leave didn't fire.

**Host & speak (v1)**
5. A herocast user creates a Space, is `host`, and the room is joinable **from the Farcaster app** (interop both ways).
6. Host enables mic and is heard; host `end` disconnects everyone.
7. A `speaker` (promoted via the Farcaster app, since stage-mgmt UI is v1.1) can publish mic from herocast; a `listener` cannot (no mic button, no publish).

**Auth, accounts, security (v1)**
8. The Farcaster bearer is minted server-side, never logged, and **never present in any browser-visible payload or network response** (assert in a test against the proxy's `/join` passthrough). Only the LiveKit room token reaches the client.
9. Switching account mid-Space aborts in-flight requests, leaves, and toasts. Read-only accounts cannot join/host.

**Resilience (v1)**
10. Proxy read failures → graceful empty/last-known UI, no crash; `/join` 4xx/5xx → toast, user stays out.
11. Flag OFF → zero Spaces code executes, `/api/spaces` returns 404, `livekit-client` absent from the main bundle (analyzer).
12. Tests pass; no regression to nav/layout/feed.

---

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | app-key JWT shape (header/payload/sig, base64url, exp); server bearer cache+refresh; `useSpacesStore` reducers (join→leave, role→canPublish, active-speaker merge, **account-switch abort/drop-stale-response**, stale-seat filter); `fidFromIdentity` | +9 |
| Unit | proxy: forwards correct path/body, attaches bearer + origin/referer **server-side**, and **strips bearer from `/join` response**; browser client sets only browser-legal headers | +4 |
| Integration | edge-fn mint (mock `decrypted_account`) → valid JWT; join→heartbeat(TTL)→leave with fake timers; visibility throttle keeps heartbeat alive | +3 |
| E2E (manual checklist, gated before flag-on) | join a live Farcaster-app room and hear audio; host-create from herocast and join from the Farcaster app; account-switch teardown; tab-close → seat frees via TTL; **Network tab shows no direct `client.farcaster.xyz` call** | +5 |

Note: do NOT write tests asserting browser `origin`/`referer` request headers — they're forbidden in the browser and are a proxy-only concern.

---

## Rollback Plan

- **Feature flag** default OFF (removes tab, unmounts bar, `/api/spaces` 404s) — the kill switch.
- Purely additive; **no migrations** (rooms live on Farcaster; v1 persists nothing). Only backend change is an additive edge-fn action + new API route.
- If Farcaster changes/blocks endpoints: proxy returns degrade-to-empty for reads, toast for writes; flag-off kills it. Revert = remove flag + new files / `git revert`.

---

## Risks & Mitigations

1. **Undocumented, reverse-engineered first-party endpoints.** Can change or be access-restricted anytime; arguably outside intended third-party use. **Operationalized (codex):** (a) explicit **product/legal approval is a launch gate** before the flag ships to anyone; (b) a synthetic compatibility probe (a scheduled run of `probe.mjs`) with **remote kill criteria** — if auth/CORS shape changes, auto-flag-off; (c) defensive client + telemetry on non-2xx rates.
2. **Auth tier unresolved until Phase 0.** Q1-red ⇒ v1 blocked pending a full Tier-2 spec (not a hand-wave). Gate Epic A on the probe.
3. **Browser/CORS (the codex blocker).** Mitigated by the proxy: browser→`/api/spaces` is same-origin; only the server talks to Farcaster (and can set `origin`/`referer`). No browser CORS dependency for v1.
4. **`livekit-client` bundle weight.** Async import from `"use client"` only; flag-gated; verify the chunk split.
5. **Mic permissions / browser audio quirks** (autoplay, iOS Safari, device selection). User-gesture-gated join+mic; explicit track attach + autoplay-retry; handle `getUserMedia` denial.
6. **Presence is poll+heartbeat (5s/10s), not push.** Up-to-5s lag; seat GC ~60s. Heartbeat keepalive while hidden, TTL-based cleanup, client-side stale filter.
7. **Proxy load.** Every participant's 5s poll + 10s heartbeat now hits herocast's backend. Fine at v1 scale; note as a scaling watch item (consider short server-side caching of discovery reads, and revisit if concurrency grows).
8. **LiveKit token in browser.** Room-scoped + short-lived = minimal blast radius (the deliberate trade vs. exposing the full Farcaster bearer).

---

## Effort Estimate (v1, post Q1-green)

| Component | Est (CC-assisted) |
|---|---|
| `app/api/spaces` proxy + edge-fn `mintAudioRoomToken` + server bearer cache/refresh + bearer-stripping | 2–2.5d |
| `spacesApi` browser client | 0.5d |
| `livekitRoom` wrapper (connect, track attach, autoplay, mic, reconnect, cleanup, bundle) | 2–2.5d |
| `useSpacesStore` lifecycle (poll/heartbeat/TTL/visibility/multi-account abort) | 2d |
| `/spaces` discovery + `LiveSpacesStrip` + host-create | 1.5d |
| `LiveSpaceBar` + `SpaceRoomView` | 2d |
| Nav/route/flag/defensive wiring/telemetry/kill-switch | 1d |
| Tests + manual interop checklist | 1.5d |
| **Total v1** | **~12.5–15 dev-days** |

Excludes design (next), Tier-2 (if probe red), and v1.1 (reactions+WS relay, chat, raise-hand, stage-mgmt, scheduled+RSVP).

---

## Sequencing / Epics

```
A. Phase 0 probe (auth + CORS) ── gates everything
        │  (green)
        ▼
B. Proxy + edge-fn mint + server bearer cache  ──►  C. spacesApi + livekitRoom
                                                            │
                                                            ▼
                                                     D. useSpacesStore (lifecycle)
                                                            │
                                        ┌───────────────────┴───────────────────┐
                                        ▼                                        ▼
                          E. Listen path (/spaces, join,           F. Host/speak path (create/
                             LiveSpaceBar, participants)              start/end, mic publish, room view)
G. Nav tab + route + feature flag + kill-switch (independent)
H. Design pass (design-consultation / DESIGN.md) — AFTER E/F skeleton lands
```
**Why:** Auth+CORS is the riskiest unknown → first, gated by the probe. The proxy (B) is the spine everything else needs. Listen (E) validates the whole realtime pipeline end-to-end before the heavier host/speak (F). Design (H) last, per instruction.

---

## Downstream (not this spec)
- **Design skill** after skeleton: live pill/indicator, participant grid, persistent bar — DESIGN.md token-only, Lucide, button/focus/motion signatures.
- **v1.1:** live reactions (herocast WS relay to keep the bearer server-side) + chat (cast replies to `rootCastHash`, reuse `submitCast`) + raise-hand + stage-management + scheduled rooms + RSVP.
- **Tier-2 spec** (only if Phase 0 Q1 is red): custody wallet-signature auth, eligibility UX, encrypted server token storage.

## Out of Scope (v1)
Live reactions, chat, raise-hand, stage-management, scheduled creation, RSVP, video/recording/clips, any self-hosted SFU, new Supabase tables, seed/custody import, and **direct browser→`client.farcaster.xyz` calls** (everything proxies).

## Related
- Reference: `.context/quorum/quorum-mobile/services/spaces/*`, `context/AudioSpaceContext.tsx`
- Probe: `.context/spaces-probe/probe.mjs` + `README.md`
- Prior auth analysis: `TODOS.md`
- Write path: `src/common/helpers/farcaster.ts`, `supabase/functions/farcaster-signer/`

---

## Review response (codex adversarial pass, 2026-06-03)

Initial draft scored **3/10**. Changes made: control plane moved behind a same-origin proxy (kills the browser CORS/forbidden-header blocker and the bearer-in-browser XSS risk); probe success criteria tightened (no more false-green on non-401); Tier-2-red path declared a blocking "write a separate spec" gate rather than a hand-wave; live reactions moved to v1.1 (WS can't ride the request-proxy cleanly); heartbeat/poll/visibility/TTL lifecycle specified; three token lifecycles separated (Farcaster bearer / LiveKit token / WS); multi-account keyed by `accountId`+FID with abort-on-switch; LiveKit web behavior specified (track attach, autoplay, reconnect, cleanup, client-only import); threat-model text corrected (signer already in IndexedDB; the real guarantee is server-side mint + bearer never in browser); undocumented-endpoint risk operationalized (legal launch gate + remote kill criteria); tests corrected to not assert browser-illegal headers.
