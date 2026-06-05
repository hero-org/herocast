import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Canonical TanStack Start + Cloudflare Workers wiring (proven by the Phase-0 spike,
// see hero-org/herocast#754). Plugin ORDER matters:
//   1. cloudflare() pins the SSR environment to workerd
//   2. tanstackStart() MUST come before viteReact()
//   3. tsconfigPaths() resolves the `@/*` -> src/* alias from tsconfig (no drift)
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
    tsconfigPaths(),
  ],
});
