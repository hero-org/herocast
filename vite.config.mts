import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// TanStack Start + Cloudflare Workers wiring (proven by the Phase-0 spike, see
// hero-org/herocast#754). Cloudflare is the destination, BUT the framework itself is
// host-portable: TanStack Start emits a universal WHATWG `fetch(request)` server entry,
// so the HOST is a build-plugin swap (CF plugin vs Vercel/Nitro), not a code change.
//
//   TARGET=cloudflare (default) → @cloudflare/vite-plugin, deploy via wrangler.
//   TARGET=vercel              → Nitro vite plugin, deploy via `vercel deploy --prebuilt`
//                                (wired by unit #1's vite 6→7 bump — see the slot comment below).
//
// The only host-specific app seams are env access (cloudflare:workers → process.env
// fallback in env.server.ts) and the edge cache (CacheBackend in trending.server.ts);
// both already degrade on non-CF runtimes.
const TARGET = process.env.TARGET ?? 'cloudflare';
const isCloudflare = TARGET === 'cloudflare';

// Empty stub for the `cloudflare:workers` virtual module on builds where the
// @cloudflare/vite-plugin isn't present to provide the real builtin.
const cloudflareWorkersStub = fileURLToPath(new URL('./src/web/lib/cloudflare-workers-client-stub.ts', import.meta.url));

// Unit #5 (#754 app shell): component modules loaded ONLY via the next/dynamic shim with
// `ssr:false` — never executed during SSR, but Rollup still emits their chunks into the
// worker (a dynamic import is statically analyzable), which pushed the bundle past the
// 3 MB gzip limit (WalletProviders drags rainbowkit/wagmi + ~15 locale/OS chunks ≈ 600 KiB
// gzip; NewCastEditor drags TipTap ≈ 280 KiB). Aliased to a throwing stub in the CF `ssr`
// environment ONLY (see `environments.ssr` below); the client bundle keeps the real
// modules. If a later unit needs one of these SSR-rendered, remove its name from the
// regex AND re-check `web:deploy:dry-run` stays < 3 MB.
const ssrClientOnlyStub = fileURLToPath(new URL('./src/web/lib/ssr-client-only-stub.tsx', import.meta.url));
// - WalletProviders / NewCastEditor: app modules loaded only via the dynamic shim (ssr:false).
// - @walletconnect/ethereum-provider: dynamically imported by wagmi's walletconnect
//   connector (wagmi is statically in the server graph via shared store/helper chains, but
//   a wallet CONNECTION can only start in a browser — the import never runs during SSR).
const ssrClientOnlyModules = /\/(?:WalletProviders|Editor\/NewCastEditor)(?:\.tsx)?$|^@walletconnect\/ethereum-provider$/;

// A plugin (not `environments.ssr.resolve.alias`) because the @cloudflare/vite-plugin
// owns the `ssr` environment's config and a user-level env alias is dropped on merge
// (verified via `resolveConfig` — the entry never reaches environments.ssr.resolve.alias).
// `applyToEnvironment` scopes the resolveId hook to the workerd env; the client env
// resolves the real modules and code-splits them exactly as before.
const ssrClientOnlyStubPlugin: PluginOption = {
  name: 'herocast:ssr-client-only-stub',
  enforce: 'pre', // run ahead of vite's alias/resolver passes so the stub wins the resolution
  applyToEnvironment: (environment) => environment.name === 'ssr',
  resolveId(source) {
    return ssrClientOnlyModules.test(source) ? ssrClientOnlyStub : undefined;
  },
};

// Host plugin goes FIRST (it pins the SSR environment).
//   TARGET=cloudflare → @cloudflare/vite-plugin (pins SSR env to workerd).
//   TARGET=vercel     → `nitro({ config: { preset: 'vercel' } })` from `nitro/vite` (nitro v3).
//                       UNBLOCKED by the vite 6→7 bump (unit #1, #754): nitro v3's Vercel
//                       Build-Output finalize runs in vite 7's `buildApp` PLUGIN hook, which
//                       vite 6 never invoked — so on vite 6 the build exited 0 but emitted only
//                       static assets (no functions/config.json) and was not deployable. On
//                       vite 7 the hook fires and `.vercel/output/{functions,config.json}` is
//                       emitted. Build with `TARGET=vercel vite build` (script: `web:build:vercel`).
//                       (The env + cache seams below are already host-portable and ready.)
const hostPlugins: PluginOption[] = isCloudflare
  ? [cloudflare({ viteEnvironment: { name: 'ssr' } })]
  : [nitro({ config: { preset: 'vercel' } })];

export default defineConfig(({ mode }) => {
  // Unit #4 (#754 stores/hooks SSR-safety): the shared stores + hooks read PUBLIC client
  // config via `process.env.NEXT_PUBLIC_*`, which the Next build inlines but Vite does not
  // (the reads resolve to `undefined`, and Supabase client creation then throws). Inline
  // the public keys here at build time, sourced from the same `.env.local` the Next app
  // already uses (`VITE_X` preferred, `NEXT_PUBLIC_X` accepted). This is build-time text
  // replacement across BOTH the client and workerd bundles — public values only.
  //
  // SECRETS ARE PINNED OUT: `NEXT_PUBLIC_NEYNAR_API_KEY` and `NEXT_PUBLIC_APP_MNENOMIC`
  // are deliberately forced to `undefined` so they can never be inlined into the client
  // bundle (#751 — the TanStack path keeps the Neynar key server-side via serverEnv()).
  const publicEnv = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  // `define` values are CODE TEXT injected into the bundle: a set key becomes a quoted
  // string via JSON.stringify; an unset key becomes the text `undefined` (JSON.stringify
  // of undefined is undefined, so `?? 'undefined'` kicks in), which evaluates to the
  // literal undefined at runtime — keeping the existing `!url` guards in shared code
  // working. Do NOT "simplify" the `?? 'undefined'` away.
  const inlinePublic = (nextKey: string): string =>
    JSON.stringify(publicEnv[nextKey.replace(/^NEXT_PUBLIC_/, 'VITE_')] ?? publicEnv[nextKey]) ?? 'undefined';
  const define = {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': inlinePublic('NEXT_PUBLIC_SUPABASE_URL'),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': inlinePublic('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    'process.env.NEXT_PUBLIC_APP_FID': inlinePublic('NEXT_PUBLIC_APP_FID'),
    'process.env.NEXT_PUBLIC_HYPERSNAP_URL': inlinePublic('NEXT_PUBLIC_HYPERSNAP_URL'),
    'process.env.NEXT_PUBLIC_ENABLE_SPACES': inlinePublic('NEXT_PUBLIC_ENABLE_SPACES'),
    'process.env.NEXT_PUBLIC_URL': inlinePublic('NEXT_PUBLIC_URL'),
    // Unit #5 (#754 app shell): the shell's lazy editor chunk (NewCastModal →
    // NewCastEditor via the next/dynamic shim) reads these three public keys
    // (useCloudinaryUpload + the dev-env guard in NewCastEditor).
    'process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME': inlinePublic('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
    'process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET': inlinePublic('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET'),
    'process.env.NEXT_PUBLIC_VERCEL_ENV': inlinePublic('NEXT_PUBLIC_VERCEL_ENV'),
    'process.env.NEXT_PUBLIC_NEYNAR_API_KEY': 'undefined', // secret — never inline (#751)
    'process.env.NEXT_PUBLIC_APP_MNENOMIC': 'undefined', // secret — never inline
  };

  return {
  define,
  build: {
    rollupOptions: {
      treeshake: {
        // Unit #4 (#754): @farcaster/core's single-file bundle runs `Factory.build()` AT
        // MODULE SCOPE inside its test-factory definitions (`MessageDataFactory.params({
        // verificationRemoveBody: VerificationRemoveBodyFactory.build(...) })`), which
        // calls `randomBytes` during module evaluation — workerd forbids that in global
        // scope ("Disallowed operation called within global scope") and the SSR render
        // dies. Nothing in the app imports `Factories`, so declaring the module
        // side-effect-free lets Rollup tree-shake the whole factory chain (incl. the
        // offending module-scope calls) out of both bundles. Everything else keeps
        // default side-effect handling.
        moduleSideEffects: (id) => !id.includes('/@farcaster/core/'),
      },
    },
  },
  // Plugin ORDER IS LOAD-BEARING — do NOT reorder (any change here is a bug, R1 in the plan):
  //   1. host plugin (cloudflare) pins the SSR environment to workerd
  //   2. tanstackStart() MUST come before viteReact()
  //   3. viteReact()     React fast-refresh / JSX
  //   4. tsconfigPaths() resolves the `@/*` -> src/* alias from tsconfig.tanstack.json (no drift)
  plugins: [
    ...hostPlugins,
    // Worker-bundle diet (unit #5) — see ssrClientOnlyStubPlugin above. CF-only: the
    // 3 MB compressed Worker limit doesn't apply to the Vercel/Nitro target.
    ...(isCloudflare ? [ssrClientOnlyStubPlugin] : []),
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
      // `@/*` → src/* build-wide. vite-tsconfig-paths only remaps imports in files inside
      // tsconfig.tanstack's `include` (src/web); transitively-pulled shared files
      // (src/common, src/stores, …) need this explicit alias so Rollup resolves their
      // `@/...` imports too. Safe: @rollup/plugin-alias matches `@` only as an exact import
      // or a `@/`-prefixed one, so it never catches scoped packages (`@tanstack/*`,
      // `@rainbow-me/*`). (Surfaced by unit #3 — first to pull deep shared chains.)
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Vite analogue of the next.config.mjs webpack alias: @farcaster/core lists
      // @faker-js/faker as a prod dependency; stub it to avoid the +7.9 MB bundle hit.
      '@faker-js/faker': fileURLToPath(new URL('./src/lib/faker-stub.ts', import.meta.url)),
      // Unit #2 navigation seam (#754): drop-in `next/*` → TanStack adapters. The SAME
      // shared `src/` components are consumed by both builds; `next build` resolves these
      // specifiers to real Next, while `vite build` (this config) re-points them to our
      // adapters — so no live-app call site is edited. Build-time ONLY: `next` is NOT a
      // runtime dependency of the TanStack tree. Defined at top level (like the faker
      // alias above) so they reach BOTH the SSR/workerd and the client environments; the
      // `environments.client` block below MERGES with (does not replace) these. Targets are
      // owned by sibling areas — A: navigation barrel (`lib/navigation/index.ts`); C:
      // link/image primitives + the `next/dynamic` lazy shim (`lib/dynamic.tsx`) — and are
      // resolved to absolute paths, mirroring the faker/cloudflare-stub aliases here.
      // Vite propagates this top-level resolve.alias into EVERY environment's resolver
      // (the workerd `ssr` env AND the `client` env), so the next/* adapters reach both
      // bundles — verified: all four appear in environments.client.resolve.alias after
      // config resolution. (The environments.client block below adds only the client-only
      // cloudflare:workers stub; it does not remove these.)
      'next/navigation': fileURLToPath(new URL('./src/web/lib/navigation/index.ts', import.meta.url)),
      'next/link': fileURLToPath(new URL('./src/web/components/link.tsx', import.meta.url)),
      'next/image': fileURLToPath(new URL('./src/web/components/image.tsx', import.meta.url)),
      'next/dynamic': fileURLToPath(new URL('./src/web/lib/dynamic.tsx', import.meta.url)),
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
  };
});
