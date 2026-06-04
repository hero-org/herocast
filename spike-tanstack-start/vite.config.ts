import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

// Canonical TanStack Start + Cloudflare Workers wiring (per CF + TanStack docs).
// Order matters: cloudflare() pins the SSR env to workerd; tanstackStart() MUST
// come before viteReact().
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
});
