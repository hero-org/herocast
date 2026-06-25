// Spike Stage 2 — host-seam fall-through on Deno. Throwaway (see ./README.md).
//
// herocast's two host-specific SERVER seams are written to switch on RUNTIME CAPABILITY,
// not build TARGET, so the same bundle is correct on workerd, Node/Vercel, and (the claim
// under test) Deno. This script mirrors that exact logic standalone — the real modules
// (`src/web/lib/{env,cache}.server.ts`) can't be imported here because they statically
// import the `cloudflare:workers` virtual module, which only resolves inside the CF build.
//
// On Deno there is no `cloudflare:workers` env and no `caches.default`, so:
//   - serverEnv() must fall through to process.env / the OS environment, and
//   - getCacheBackend() must pick the in-process MemoryCacheBackend.
//
// Headless — safe to run anywhere Deno is installed.
//   deno run --allow-env scripts/spikes/deno-desktop/seam-fallthrough.ts

// --- replica of env.server.ts::serverEnv (workerEnv is absent on Deno) -----------------
const workerEnv: Record<string, string | undefined> | undefined = undefined; // no cloudflare:workers on Deno
function serverEnv(key: string): string | undefined {
  const fromWorker = workerEnv?.[key];
  if (fromWorker !== undefined && fromWorker !== '') return fromWorker;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProcess = proc?.env?.[key];
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  return undefined;
}

// --- replica of cache.server.ts::getCacheBackend ---------------------------------------
function cacheBackendKind(): 'cloudflare' | 'memory' {
  const cfCache = (globalThis as { caches?: { default?: unknown } }).caches?.default;
  return cfCache ? 'cloudflare' : 'memory';
}

// --- assertions ------------------------------------------------------------------------
type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];

// Cache seam: must resolve to the memory backend on Deno (no Cache API global).
const kind = cacheBackendKind();
checks.push({
  name: 'cache backend → memory',
  pass: kind === 'memory',
  detail: `getCacheBackend() picked "${kind}" (expected "memory" — Deno has no caches.default)`,
});

// Env seam: the runner sets HEROCAST_SPIKE_ENV in the OS environment. serverEnv() should
// read it via process.env. Cross-check against Deno.env so we can tell *why* if it fails.
const SENTINEL = 'HEROCAST_SPIKE_ENV';
const viaServerEnv = serverEnv(SENTINEL);
const viaDenoEnv = (() => {
  try {
    return Deno.env.get(SENTINEL);
  } catch {
    return undefined; // --allow-env not granted
  }
})();
checks.push({
  name: 'serverEnv() reads OS env via process.env',
  pass: viaServerEnv === 'ok',
  detail:
    viaServerEnv === 'ok'
      ? 'process.env fall-through works on Deno'
      : `serverEnv()="${viaServerEnv}"; Deno.env="${viaDenoEnv}". ` +
        (viaDenoEnv === 'ok'
          ? 'Deno did NOT populate process.env — the real seam would need a Deno.env branch (record this).'
          : 'sentinel not set / --allow-env missing — run via run.sh.'),
});

// --- report ----------------------------------------------------------------------------
let allPass = true;
console.log('\n  herocast × Deno desktop — Stage 2 seam fall-through\n');
for (const c of checks) {
  allPass &&= c.pass;
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}\n        ${c.detail}`);
}
console.log('');
if (!allPass) Deno.exit(1);
