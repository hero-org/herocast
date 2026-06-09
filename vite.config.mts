import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// TanStack Start + Cloudflare Workers wiring (proven by the Phase-0 spike, see
// hero-org/herocast#754). Cloudflare is the destination, BUT the framework itself is
// host-portable: TanStack Start emits a universal WHATWG `fetch(request)` server entry,
// so the HOST is a build-plugin swap (CF plugin vs Vercel/Nitro), not a code change.
//
//   TARGET=cloudflare (default) → @cloudflare/vite-plugin, deploy via wrangler.
//   TARGET=vercel              → Nitro vite plugin (wired by the Vercel spike, #9).
//
// The only host-specific app seams are env access (cloudflare:workers → process.env
// fallback in env.server.ts) and the edge cache (CacheBackend in trending.server.ts);
// both already degrade on non-CF runtimes.
const TARGET = process.env.TARGET ?? 'cloudflare';
const isCloudflare = TARGET === 'cloudflare';

// Empty stub for the `cloudflare:workers` virtual module on builds where the
// @cloudflare/vite-plugin isn't present to provide the real builtin.
const cloudflareWorkersStub = fileURLToPath(new URL('./src/web/lib/cloudflare-workers-client-stub.ts', import.meta.url));

// Host plugin goes FIRST (it pins the SSR environment).
//   TARGET=cloudflare → @cloudflare/vite-plugin (pins SSR env to workerd).
//   TARGET=vercel     → host-plugin slot is intentionally EMPTY today. The Vercel path
//                       is `nitro({ config: { preset: 'vercel' } })` from `nitro/vite`
//                       (verified-correct wiring), but it is BLOCKED on vite 6: nitro v3's
//                       Vercel Build-Output finalize runs in vite 7's `buildApp` PLUGIN
//                       hook, which vite 6 never invokes — so the build exits 0 but emits
//                       only static assets (no functions/config.json) and is NOT
//                       deployable. When the repo moves to vite 7, add `nitro` as a devDep
//                       and put `nitro({ config: { preset: 'vercel' } })` here. (The env +
//                       cache seams below are already host-portable and ready.)
const hostPlugins: PluginOption[] = isCloudflare ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : [];

export default defineConfig({
  // Plugin ORDER IS LOAD-BEARING — do NOT reorder (any change here is a bug, R1 in the plan):
  //   1. host plugin (cloudflare) pins the SSR environment to workerd
  //   2. tanstackStart() MUST come before viteReact()
  //   3. viteReact()     React fast-refresh / JSX
  //   4. tsconfigPaths() resolves the `@/*` -> src/* alias from tsconfig.tanstack.json (no drift)
  plugins: [
    ...hostPlugins,
    tanstackStart({
      // `srcDirectory` re-roots the whole framework into src/web/ so the new TanStack
      // source stays isolated from the live Next app and is trivially deletable. Per the
      // installed start-plugin-core schema (parseStartConfig), the plugin resolves
      // entries from `srcDirectory`, and resolves routesDirectory/generatedRouteTree as
      // path.resolve(root, srcDirectory, <value>). So these paths are relative to
      // srcDirectory (NOT the project root).
      srcDirectory: 'src/web',
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
      },
    }),
    viteReact(),
    // Resolve @/* from the standalone TanStack tsconfig (the root tsconfig is the Next
    // app's jsx:preserve + next-plugin config and must not drive this build).
    tsconfigPaths({ projects: ['./tsconfig.tanstack.json'] }),
  ],
  resolve: {
    alias: {
      // Vite analogue of the next.config.mjs webpack alias: @farcaster/core lists
      // @faker-js/faker as a prod dependency; stub it to avoid the +7.9 MB bundle hit.
      '@faker-js/faker': fileURLToPath(new URL('./src/lib/faker-stub.ts', import.meta.url)),
      // NON-CF builds only: there is no @cloudflare/vite-plugin to register the
      // `cloudflare:workers` builtin in ANY environment, so alias it everywhere to the
      // empty stub. serverEnv() then falls through to process.env (populated on Node/
      // Vercel). This top-level alias is SAFE only because the cloudflare plugin is
      // absent here — on the CF build it would hijack the worker env and break the
      // plugin's own `virtual:cloudflare/export-types`, so there it's client-scoped below.
      ...(isCloudflare ? {} : { 'cloudflare:workers': cloudflareWorkersStub }),
    },
  },
  // CF build only: scope the `cloudflare:workers` → stub alias to the CLIENT env (the
  // worker `ssr` env keeps the real builtin). The route tree statically imports the
  // server route handlers, whose graph touches env.server.ts's `cloudflare:workers`
  // import; import-protection mocks those `.server.ts` modules out of the client bundle,
  // but Rollup still RESOLVES the specifier first — without this the client build dies
  // with "Rollup failed to resolve import 'cloudflare:workers'". The stub is never
  // executed (its only callers are server-side and stripped from the client).
  ...(isCloudflare
    ? {
        environments: {
          client: {
            resolve: {
              alias: {
                'cloudflare:workers': cloudflareWorkersStub,
              },
            },
          },
        },
      }
    : {}),
});
