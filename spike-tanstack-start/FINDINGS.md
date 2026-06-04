# Phase 0 spike — verbatim findings

Runtime: `wrangler dev` on the `vite build` output (`dist/server/wrangler.json`), i.e.
**real workerd** with `compatibility_flags=["nodejs_compat"]`, `compatibility_date=2026-06-04`.
The `"userAgent": "Cloudflare-Workers"` below is workerd self-identifying — not Node.

## Verdict: GO. 3/3 unknowns = WORKS. The #1 risk (Neynar SDK) needed no fallback.

---

## Commands

```bash
pnpm build                                                   # vite build (client + workerd SSR bundle)
npx wrangler dev -c dist/server/wrangler.json --port 8799    # boot on workerd
curl localhost:8799/api/probe                                # request 1 (no cookie)
curl localhost:8799/api/probe                                # request 2 (cache)
curl localhost:8799/api/probe -H "Cookie: sb-...-auth-token=base64-<session>"   # request 3
curl localhost:8799/                                          # SSR HTML
npx wrangler deploy -c dist/server/wrangler.json --dry-run    # deployable-artifact check
```

## Build (the bundling test for Q1)

```
vite v6.4.3 building for production...
✓ 157 modules transformed.                 # client bundle — 332 KB, NO neynar/supabase (server-split worked)
vite v6.4.3 building SSR bundle for production...
✓ 1439 modules transformed.                # workerd SSR bundle — neynar SDK + axios + viem + supabase all bundled, no error
dist/server/assets/getUser-CSlY47qq.js     2,615.13 kB   # the server chunk (axios+viem are the weight)
✓ built in 2.95s
```

## Request 1 — `GET /api/probe` (no cookie)

```json
{
  "runtime": { "hasCachesDefault": true, "hasProcess": true, "neynarKeyPresent": true,
               "supabaseEnvPresent": true, "userAgent": "Cloudflare-Workers" },
  "q1_neynar_sdk":  { "ok": true, "count": 3, "firstAuthor": "irynaliakh.eth" },   // Q1: SDK WORKS
  "q1_neynar_rest": { "ok": true, "count": 3, "firstAuthor": "irynaliakh.eth" },   // fallback also works (unused)
  "q2_cache": { "cacheStatus": "MISS", "source": "neynar-sdk",
                "fetchedAt": "2026-06-04T21:10:11.933Z", "count": 10 },            // Q2: stored
  "q3_supabase": { "cookiesSeen": [], "supabaseCookiesSeen": [], "user": null,
                   "error": { "name": "AuthSessionMissingError", "message": "Auth session missing!", "status": 400 },
                   "networkValidationAttempted": false }                            // Q3: clean no-session, no crash
}
```

## Request 2 — `GET /api/probe` again → Cache **HIT** (Q2)

```json
{ "q1_neynar_sdk": { "ok": true, "count": 3, "firstAuthor": "irynaliakh.eth" },
  "q2_cache": { "cacheStatus": "HIT", "source": "neynar-sdk",
                "fetchedAt": "2026-06-04T21:10:11.933Z", "count": 10 } }   // SAME fetchedAt = served from Cache API
```

## Request 3 — `GET /api/probe` with synthetic `sb-...-auth-token` cookie (Q3)

```json
{ "cookiesSeen": ["sb-spikedummyproject0000-auth-token"],
  "supabaseCookiesSeen": ["sb-spikedummyproject0000-auth-token"],          // adapter READ the cookie from the request
  "user": null,
  "error": { "name": "AuthRetryableFetchError", "message": "internal error; ...", "status": 0 },
  "networkValidationAttempted": true }     // getUser() parsed the session + hit {url}/auth/v1/user (fails: dummy host)
```

Full path proven: cookie read → session decoded → access_token extracted → network
validation call to Supabase, all on workerd. Only a real Supabase backend (out of spike
scope) is needed to return an actual user.

## Request 4 — `GET /` SSR HTML (server-loaded list)

`HTTP 200`, 4071 bytes. The initial HTML contains the server-rendered list (loader ran
`createServerFn` on workerd; `cache: HIT`, `source: neynar-sdk`):

```html
<ol><li><strong>@jake</strong>: You should go outside for a walk during any call ...</li>
    <li><strong>@burr.eth</strong>: As spaces become more and more popular ...</li>
    <li><strong>@cameron</strong>: I don't understand why it's so hard ...</li>
    <li><strong>@0xleonardo</strong>: Building late. Shipping early. ...</li>
    <li><strong>@charmsai</strong>: The Charms Leaderboard is live ...</li></ol>
```

## Deploy artifact check (no CF creds in sandbox)

```
npx wrangler deploy -c dist/server/wrangler.json --dry-run
Total Upload: 3409.26 KiB / gzip: 616.32 KiB
--dry-run: exiting now.
```

`wrangler whoami` → not authenticated, so a real edge `wrangler deploy` was **not**
performed. Build + dry-run + local workerd confirm the worker is deployable; 616 KiB gzip
is well under the 3 MB Worker limit.

## Notes / honesty

- The Neynar SDK working on workerd was **not** the expected outcome — static analysis
  showed it depends on `axios@1.17.0`, whose `http` adapter is selected when `process`
  exists (true under `nodejs_compat`). `nodejs_compat` evidently provides enough of
  `node:http`/`node:stream` for axios's outbound request to succeed. It works empirically;
  the exact adapter path wasn't dissected.
- `@openapitools/openapi-generator-cli` (a heavy Neynar dep) is codegen-only and is **not**
  pulled into the bundle.
- The cache substitute uses the Cache API. KV is the alternative for non-HTTP-shaped values
  and persists globally; Cache API is per-colo. Either satisfies the `unstable_cache` need.
