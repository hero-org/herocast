# Phase 0.5 — de-risk the two unknowns the spike skipped

Both verified on **real workerd** (`wrangler dev` on the built bundle), then **codex-reviewed** and the findings corrected. Verdict: **both WORK on workerd.**

| Unknown | Result | Vehicle |
|---|---|---|
| `embeds/metadata` WASM (`@officialunofficial/trek`) — only HIGH risk left | ✅ **WORKS** | `/api/wasm` |
| Auth **WRITE**/login cookie path (chunked `sb-*.0/.1`) | ✅ **WORKS** | `/api/auth-write` → `/api/probe` |

---

## 0.5a — WASM on workerd ✅

**The fix:** prod (`app/api/embeds/metadata/route.ts`) does `readFileSync(...trek_rs_bg.wasm)` + `initSync({ module: buffer })` — `fs` can't run on workerd. Replace with a **Workers module import**:

```ts
import * as trek from '@officialunofficial/trek';
import trekWasm from '@officialunofficial/trek/trek_rs_bg.wasm'; // -> WebAssembly.Module
trek.initSync({ module: trekWasm });                            // module-scope, per isolate
```

`@cloudflare/vite-plugin` bundles the `.wasm` (emitted as `compiled-wasm`), workerd compiles it at deploy, and `initSync` does a synchronous `new WebAssembly.Instance(module)` (the runtime `WebAssembly.compile(bytes)` path workerd forbids is skipped).

Evidence (`/api/wasm`, on `"Cloudflare-Workers"`):
```json
// sample HTML:
{ "ok": true, "wasmIsModule": true, "parseMs": 27,
  "title": "Spike OG Title — Trek on workerd",
  "description": "OpenGraph description parsed by the trek Rust/WASM module…",
  "image": "https://example.com/preview.png" }
// live fetch of https://github.com: title "GitHub · Change is constant…", parseMs 33
```

- Bundle cost: trek `.wasm` = 1.8 MB raw / **698 KB gzip**; whole worker ≈ 5.1 MB raw / **~1.3 MB gzip** — under the 3 MB compressed Worker limit (free), well under paid.
- **Not measured:** CPU time for `parse()` on very large/hostile HTML (Workers CPU limits). Real pages parsed in <35 ms.

**Codex correction (real bug, also latent in prod):** trek 0.2.1 `#[serde(flatten)]`s metadata to the result ROOT — `result.metadata` is `undefined`. The first probe (and **`app/api/embeds/metadata/route.ts:126,142-143`**) read `result.metadata.*` / `og_*`, which don't exist → `description`/`image` always null → prod silently always falls through to Microlink/Neynar for those fields. Correct fields are top-level: `result.title` / `result.description` / `result.image`. Fixed in the probe; **prod has the same latent bug — worth a one-line fix independent of the migration.**

## 0.5b — auth WRITE / chunking on workerd ✅

**What it proves:** on a real `exchangeCodeForSession`, `@supabase/ssr`'s `applyServerStorage` saves the session as `base64-`+base64url(JSON), runs `createChunks()`, and writes each chunk via the `setAll` adapter → `Set-Cookie`. This probe reproduces that with the library's OWN helpers and writes the chunks via **TanStack Start's `setCookie`** (the framework path), forcing a large session so it must chunk:

```
sessionJsonLength 4205 -> cookieValue 5614 -> createChunks -> .0 (3180) + .1 (2434)
```
`/api/auth-write` emits **two Set-Cookie headers** on workerd via `setCookie`, with the library's `DEFAULT_COOKIE_OPTIONS` (`path:/, sameSite:lax, httpOnly:false, maxAge:400d`) + `secure`:
```
set-cookie: sb-…-auth-token.0=base64-<…>; Max-Age=34560000; Path=/; Secure; SameSite=Lax
set-cookie: sb-…-auth-token.1=<…>;       Max-Age=34560000; Path=/; Secure; SameSite=Lax
```
Round-trip — replaying those two cookies to `/api/probe` (the read path): `cookiesSeen:[.0,.1]`, `sessionCookieMatched:true`, `combineChunks` reassembled the session, `getUser` reached the network (`networkValidationAttempted:true`, `AuthRetryableFetchError` on the dummy host). **Write → chunk → read → reassemble all work on workerd.**

**Codex corrections applied:** write via TanStack `setCookie` (not a hand-rolled `new Response`); use the library's `DEFAULT_COOKIE_OPTIONS` (incl. `httpOnly:false`, which is Supabase's intended default) rather than invented attributes.

**Not proven (out of spike scope, low risk):** the live OAuth `exchangeCodeForSession` network exchange (needs a real auth code) and a *successful* `getUser` against a live Supabase (needs a real session). Both are a `fetch` + the already-proven read path. Stale-chunk deletion (`maxAge:0` for orphaned chunks) also not exercised.

---

## Net
The only HIGH risk in #754 (WASM) is resolved, and the auth write/login plumbing works on workerd. **No HIGH-risk unknowns remain before Phase 1.** Remaining Phase-1 work is the known-mechanical set (Sentry rewire, `next/font`, `next/image`, `next/navigation` volume).
