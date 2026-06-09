import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Canonical TanStack Start + Cloudflare Workers wiring (proven by the Phase-0 spike,
// see hero-org/herocast#754).
//
// Plugin ORDER IS LOAD-BEARING — do NOT reorder (any change here is a bug, R1 in the plan):
//   1. cloudflare()    pins the SSR environment to workerd
//   2. tanstackStart() MUST come before viteReact()
//   3. viteReact()     React fast-refresh / JSX
//   4. tsconfigPaths() resolves the `@/*` -> src/* alias from tsconfig.tanstack.json (no drift)
//
// All new TanStack source lives under src/web/ (routes + generated route tree) so the
// new framework stays isolated from the live Next app and is trivially deletable.
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      // `srcDirectory` re-roots the whole framework into src/web/ so the new
      // TanStack source stays isolated from the live Next app and is trivially
      // deletable. Per the installed start-plugin-core schema (parseStartConfig),
      // the plugin resolves entries (router/client/server/start) from `srcDirectory`,
      // and resolves routesDirectory/generatedRouteTree as
      //   path.resolve(root, srcDirectory, <value ?? 'routes' | 'routeTree.gen.ts'>).
      // So these paths MUST be relative to srcDirectory (NOT the project root) — the
      // defaults already land them in src/web/, but they are spelled out for clarity.
      srcDirectory: 'src/web',
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
      },
    }),
    viteReact(),
    // Resolve @/* from the standalone TanStack tsconfig (the root tsconfig is the
    // Next app's jsx:preserve + next-plugin config and must not drive this build).
    tsconfigPaths({ projects: ['./tsconfig.tanstack.json'] }),
  ],
  resolve: {
    alias: {
      // Vite analogue of the next.config.mjs webpack alias: @farcaster/core lists
      // @faker-js/faker as a prod dependency; stub it to avoid the +7.9 MB bundle hit.
      // Dormant in Phase 1 (the probe doesn't import @farcaster/core) but wired now so
      // the regression can't sneak in the instant store/@farcaster/core code lands.
      '@faker-js/faker': fileURLToPath(new URL('./src/lib/faker-stub.ts', import.meta.url)),
    },
  },
  environments: {
    // CLIENT-only alias for the `cloudflare:workers` virtual module.
    //
    // The @cloudflare/vite-plugin registers `cloudflare:workers` as a builtin ONLY in
    // the worker (`ssr`) environment. The route tree statically imports the server route
    // handlers (api/health, api/auth/callback), whose import graph touches the
    // `.server.ts` env reader (env.server.ts → `import { env } from 'cloudflare:workers'`).
    // import-protection mocks those `.server.ts` modules out of the client bundle, but
    // Rollup still RESOLVES the specifier graph first, so without a client resolver the
    // build dies with "Rollup failed to resolve import 'cloudflare:workers'".
    //
    // This alias points the specifier at an empty client stub. It is scoped to `client`
    // ONLY — a top-level (all-env) alias would ALSO hijack the worker env and break the
    // cloudflare plugin's own `virtual:cloudflare/export-types`
    // (`import { WorkerEntrypoint, DurableObject, WorkflowEntrypoint } from
    // 'cloudflare:workers'`). The worker env keeps the real builtin; the stub is never
    // executed (its only would-be callers are server-side and stripped from the client).
    client: {
      resolve: {
        alias: {
          'cloudflare:workers': fileURLToPath(
            new URL('./src/web/lib/cloudflare-workers-client-stub.ts', import.meta.url)
          ),
        },
      },
    },
  },
});
