# TODOs

Captured during `/plan-eng-review` of the Quilibrium-clients spikes (`.context/spikes/`).

## Open

### Migrate `useSocialGraphSync` through the provider abstraction

**Source**: `/plan-eng-review` (Spike 1 §10 row 5), 2026-05-28

**Context**: `src/hooks/useSocialGraphSync.ts:7,33` hits Hypersnap directly for `user/following` / `user/followers`. It bypasses the provider abstraction, so:
- The localStorage/server `prefer_hypersnap` toggle does not affect it.
- Telemetry added to `neynar.ts`/`hypersnap.ts` providers is invisible to this path.
- Capability-based fallback does not apply.

PR #721 explicitly skipped this.

**Action**: add `getFollowing(fid)` and `getFollowers(fid)` to the `FarcasterProvider` interface, implement in both `neynar.ts` and `hypersnap.ts`, and route `useSocialGraphSync` through `getProvider()`.

**Effort**: ~1 day.

**Why it matters**: completes the provider abstraction; closes a telemetry blind spot before we use telemetry to evaluate Hypersnap readiness for any future default-flip.

**Blocked by**: nothing.

---

### Investigate wallet-signature auth path before reopening Spike 2 (DMs)

**Source**: `/plan-eng-review`, 2026-05-28

**Context**: Spike 2 (Direct Casts via Warpcast bearer-token API) was dropped this session because the proposed mnemonic-storage path is a categorical security regression vs. the existing `wc_secret_` developer-API-key flow. Spike 2 §8 last paragraph sketches a safer alternative: derive the bearer token via a wallet signature (Coinbase / Rainbow / Frame / hardware) — no mnemonic ever enters herocast.

**Action**: live API probe against `client.farcaster.xyz` to confirm whether `lookupFarcasterAccount` (or equivalent) accepts a `(custodyAddress, signature_over_challenge)` tuple instead of `(custodyAddress, custodyPrivateKey)`. If it does, the Spike 2 trust profile collapses and we can revisit. If it does not, Spike 2 stays dropped.

**Effort**: 0.5–1 day for the live probe + a 1-page memo.

**Why it matters**: if onboarding friction from the `wc_secret_` flow ever becomes a real product blocker, this is the path to investigate before falling back to mnemonic storage.

**Blocked by**: actual product signal that onboarding friction is a real blocker. Don't burn the day without it.
