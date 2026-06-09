/// <reference types="vite/client" />

// Ambient module for the Cloudflare Workers runtime `env` binding. Declaring it here
// keeps `tsc` green before `wrangler types` has generated worker-configuration.d.ts.
// Read this only inside server handlers (see src/web/lib/env.ts) — module-scope reads
// on workerd return undefined.
declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}

// Vite asset-as-URL imports (e.g. `import appCss from '@/globals.css?url'`).
declare module '*?url' {
  const url: string;
  export default url;
}

// WebAssembly module imports (Workers-style `import mod from './x.wasm'`).
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}

// Client build-time env, inlined by Vite from VITE_*.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
