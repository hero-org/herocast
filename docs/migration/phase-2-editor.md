# Unit #8 — editor (TipTap) + embeds

> Track B / epic #754. Surface tier, fans out from the foundation chain. Makes the herocast
> cast composer — `NewCastEditor` (TipTap) reached through the already-mounted `NewCastModal` —
> **render and function on the TanStack client**: compose, @-mentions, /channel, image/video
> uploads (Cloudinary), and embed composition (`EmbedsEditor`). Blocked-by: **#3 ✅, #5 ✅**
> (the editor's data routes — mentions/channels — also depend on **#10 ✅**). Template:
> `phase-1.md`. Reuse contract: `conventions.md`.

## Objective

Prove and harden the cast editor on the client, reusing the live-app component **verbatim**:

1. The titlebar **"Cast" action** and **cmd+k → New Post** both `addNewPostDraft()` + open
   `NewCastModal` (wired by unit #5, mounted in the `src/home` shell). `NewCastModal` lazy-loads
   `NewCastEditor` through the `next/dynamic` shim (`ssr:false`) — this unit makes that lazy
   client chunk **work**.
2. **@-mentions** (`getProvider().searchUsers` → `/api/users/search`) and **/channel** mentions
   (`getProvider().searchChannels` → `/api/channels/search`) resolve through the FarcasterProvider
   seam against the unit-#10 worker routes.
3. **Image/video uploads** go direct from the client to Cloudinary (`useCloudinaryUpload`,
   `api.cloudinary.com`) using the `NEXT_PUBLIC_CLOUDINARY_*` keys inlined by the vite `define`
   allowlist (added in unit #5); uploaded images become image embeds rendered by `EmbedsEditor`.
4. **Embed composition**: auto-detected URLs and uploaded media populate the `EmbedsEditor`
   list; the **draft store + publish flow are reused VERBATIM** (`useDraftStore`,
   `updateDraftById`, `publishDraftById`, `scheduleDraftById`).

**The load-bearing reality: this is a PROVE-IT-WORKS unit, not a re-implementation.** The mount
path (#5) and the data routes the editor calls (#10) were already wired; the editor, its hooks
(`useCastEditor`, `useCloudinaryUpload`), `EmbedsEditor`, `MentionsList`/`ChannelList`, and the
draft store are consumed **byte-identically** to the live Next app through the unit-#2 build
seams. The editor is also **already in `ssrClientOnlyModules`** (vite.config.mts, unit #5), so it
ships as a client-only chunk and is stubbed out of the worker bundle. What this unit adds is the
**first real React-19 + @tiptap/react v3 interactive QA** (deferred from phase-1), a throwaway
canary probe that exercises the editor without a session, and the documentation of the seams +
the one data boundary (`/api/embeds/metadata` → unit #11).

## Non-goals

- **No publish / signer (the write path).** `publishDraftById` → `submitCast` is reused verbatim,
  but firing it needs an **active account + a registered Farcaster signer**, which lands with
  **unit #9 (auth/accounts/onboarding)**. This unit verifies the editor/upload/mention/embed
  surface up to that boundary (the QA probe is logged-out; `account` is `undefined`, mentions use
  the `NEXT_PUBLIC_APP_FID` fallback). The "Post"/"Schedule" buttons render and wire to the store;
  end-to-end publish is a #9 canary check.
- **No `/api/embeds/metadata` route.** Link-embed OpenGraph previews (`OpenGraphImage` →
  `useUrlMetadata` → `/api/embeds/metadata`) degrade gracefully to the plain `UrlEmbed` card while
  that route is unported. It is **trek-WASM-coupled and explicitly owned by unit #11**
  (`phase-3-data-routes.md` §scope). Porting it here would duplicate #11's WASM work.
- **No `/post` thread-composer page.** `ThreadComposer/ThreadPostCard` statically imports
  `NewCastEditor`; that page is a later surface unit (#12 bucket). It is covered by the existing
  stub regex today (see Gotchas) but is not mounted/SSR'd by this unit.
- **No shared-file edits and no new vite/config changes.** The editor chunk was already in
  `ssrClientOnlyModules` and the Cloudinary `define` keys were already added in unit #5. This unit
  edits nothing outside `src/web/` + the migration-owned status doc.

## Audit (editor client graph, verified on `main` + the running canary)

| # | Surface | Finding |
|---|---------|---------|
| E1 | `NewCastModal` → `dynamic(() => import('./Editor/NewCastEditor'), { ssr:false })` | Mounted in the `src/home` shell (unit #5). The shim renders nothing on the server, mounts the lazy chunk after client mount — no hydration drift, no SSR of TipTap. |
| E2 | `NewCastEditor` (`NewPostEntry`) + `useCastEditor` (TipTap v3) | Mounts under **React 19** with `immediatelyRender:false` (SSR-safe by construction; never SSR'd anyway). `useTipTapEditor` intentionally has **no deps array** (#723) — extension configs captured once, mutable state read via refs. Verified: editor mounts, composes, destroys cleanly, **zero console/page errors**. |
| E3 | @-mention / /channel suggestion configs (`createFixedMentionsSuggestionConfig`, `MentionsList`, `ChannelList`) | `getProvider().searchUsers` → `/api/users/search`; `getProvider().searchChannels` → `/api/channels/search` (both unit #10). `viewer_fid` is the account fid or the `define`-inlined `NEXT_PUBLIC_APP_FID` fallback (verified clean `18665`, no quotes, in the client chunk). Dropdown renders + selection inserts a mention. |
| E4 | `useCloudinaryUpload` | Direct client `axios.post` to `api.cloudinary.com/v1_1/<cloud>/image/upload`; `<cloud>`/preset from the `define`-inlined `NEXT_PUBLIC_CLOUDINARY_*` (unit #5). Verified the real cloud name reaches the client chunk; upload → image embed → `<img>` render works. |
| E5 | `EmbedsEditor` → `OpenGraphImage` → `useUrlMetadata` → `/api/embeds/metadata` | **Unported (404) → graceful `UrlEmbed` fallback** (domain card). No crash, no error boundary; the only canary console noise is the expected 404 (React Query `retry:1` ⇒ 2 requests). **Owned by unit #11** (trek-WASM). Image embeds render directly via `<img>` and need no metadata route. |
| E6 | `next/link` (in `NewCastEditor`) + `next/dynamic` (in `NewCastModal`) | Resolve to the unit-#2 adapters via the vite aliases — no live call site edited. |
| E7 | draft store + publish flow (`useDraftStore`) | Reused verbatim. `updateDraftById`/embed-sync round-trip through the live store (probe seeds a real `writing` draft). `publishDraftById`→`submitCast` is present but needs an account+signer (#9). |

## Files

- **New:** `docs/migration/phase-2-editor.md` (this file); `src/web/routes/profile-editor-probe.tsx`
  (**throwaway** canary probe — mounts `NewCastEditor` outside the shell; path-prefixed `profile-`
  to ride AuthContext's logged-out allowlist — see Gotchas; enumerated for the #13 sweep).
- **Edit (migration-owned):** `docs/migration/strategy.md` (status: #6 → ✅ housekeeping, #8 → 🔍).
- **Untouched:** `app/`, `pages/`, `next.config.mjs`, `vercel.json`, `src/globals.css`, **every
  shared `src/` file**, and **`vite.config.mts`** (the `Editor/NewCastEditor` stub entry and the
  `NEXT_PUBLIC_CLOUDINARY_*`/`NEXT_PUBLIC_VERCEL_ENV` `define` keys already landed in unit #5).

## Reuse list (no forks)

- `NewCastModal` / `NewCastEditor` / `EmbedsEditor` / `MentionsList` / `ChannelList` — shared,
  verbatim, via the `next/*` build aliases.
- `useCastEditor`, `useCloudinaryUpload`, `useChannelLookup`, `useAppHotkeys` — shared hooks.
- `getProvider()` — the FarcasterProvider seam (mentions/channels → unit-#10 routes).
- `useDraftStore` — the draft store + publish/schedule flow, verbatim.
- The `next/dynamic` `ssr:false` shim (`src/web/lib/dynamic.tsx`) + `ssrClientOnlyModules` stub
  (`vite.config.mts`) — both from earlier units; this unit only consumes them.

## Gotchas (this unit)

- **The editor was already kept out of the worker bundle (unit #5).** The `ssrClientOnlyModules`
  regex matches `Editor/NewCastEditor`; verified after this unit: **0 TipTap/ProseMirror chunks in
  `dist/server`**, the editor lives only in `dist/client/assets/NewCastEditor-*.js`, worker gzip
  **2293.58 KiB < 3 MB**. Do not move the editor out of that list.
- **`ThreadComposer/ThreadPostCard` STATICALLY imports `NewCastEditor`.** Today the stub regex
  re-resolves that specifier to the throwing stub in the `ssr` env, so it stays out of the worker —
  but the stub **throws if rendered during SSR**. The `/post` thread-composer page is not ported
  here; the unit that ports it must keep `ThreadPostCard` client-only (it is `ssr:false`-shaped) or
  it will hit the stub's throw on the server.
- **The probe rides the `/profile` auth allowlist on purpose.** `AuthContext` (in `__root`'s
  `<Providers>`, wrapping every route) client-redirects logged-out users to `/login` on any path
  not starting with `/profile`, `/conversation`, or `/analytics`. `AuthContext` is a shared
  live-app file and must not be edited to allowlist a probe, so the probe mounts at
  `/profile-editor-probe` (no collision with the `_app.profile.*` routes, which need a `/` segment).
- **mentions/channels return data only on a paid Neynar key.** The routes validate + proxy Neynar
  correctly; the local canary's free-tier `.dev.vars` key returns **402** for `searchUser`/channel
  search (prod's paid key returns results). This is an env limit, not a code defect — the QA mocked
  the search responses to assert the dropdown UX; the live `viewer_fid`/`q`/`limit` params were
  confirmed correct against the running worker.
- **`/api/embeds/metadata` 404 is expected** (unit #11). It is the only console noise on the canary;
  link embeds show the plain `UrlEmbed` card until #11 ports the route (with the trek-WASM fast path
  + the #758 serde-flatten fix per `phase-1.md` §4.x notes).

## Definition of Done / cf-canary (status as implemented)

- [x] `pnpm web:build`, `pnpm web:typecheck`, live `pnpm typecheck` all **0** (coexistence holds;
      no shared-file edits → `pnpm test` trivially unaffected).
- [x] Worker bundle: **0** TipTap/ProseMirror modules in `dist/server`; editor present only in the
      `dist/client` `NewCastEditor-*.js` chunk; **`web:deploy:dry-run` gzip 2293.58 KiB < 3 MB**
      (unchanged from unit #5's 2289 KiB high-water — the editor adds nothing to the worker).
- [x] Real-browser canary QA (`pnpm web:serve`, workerd + full `.dev.vars`, headless Chromium):
      `/profile-editor-probe` SSRs 200; the editor **mounts with zero console/page errors**;
      compose works; the @-mention dropdown renders + inserts; image upload → Cloudinary → image
      embed renders; URL auto-detect adds an embed and **degrades gracefully** when
      `/api/embeds/metadata` 404s (no crash/error boundary).
- [x] No regression: existing probes (`stores-probe`, `nav-probe`, `providers-probe`,
      `migration-probe`, `_app.shell-probe`) still 200; SSR of shell routes unaffected (editor is
      never SSR'd).

## Follow-ups surfaced (not fixed here)

- **[#11] Port `/api/embeds/metadata`** (trek-WASM + Microlink + Neynar crawl; bake the #758
  serde-flatten fix) — link-embed OG previews stay plain URL cards until then.
- **[#12 / `/post`] Thread-composer page** — `ThreadComposer/ThreadPostCard` statically imports
  `NewCastEditor`; keep it client-only (`ssr:false`) when that surface ports, or it hits the
  ssr-stub throw.
- **[#9] End-to-end publish** — needs an active account + registered signer; verify the
  Post/Schedule write path on the session-in canary once #9 lands.
- **[#13] Probe sweep** now covers **six** throwaway routes — add `profile-editor-probe` to the
  cutover deletion list alongside `migration-probe`, `nav-probe`, `providers-probe`, `stores-probe`,
  `_app.shell-probe`.
