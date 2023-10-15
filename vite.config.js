import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, splitVendorChunkPlugin } from 'vite'
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import react from '@vitejs/plugin-react'
import inject from '@rollup/plugin-inject';
import nodePolyfills from "rollup-plugin-polyfill-node";
import { resolve } from 'path';

const libraries = [
  'react',
  'react-router-dom',
  'react-dom',
];

import { dependencies } from './package.json';
function renderChunks(deps) {
  let chunks = {};
  Object.keys(deps).forEach((key) => {
    if (libraries.includes(key)) return;
    chunks[key] = [key];
  });
  return chunks;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  assetsInclude: ['**/*.webp', '**/*.png', '**/*.jpg'],
  plugins: [
    react(),
    sentryVitePlugin({
      org: "herocast-pr",
      project: "herocast-client"
    })
  ],
  server: {
    port: 4590,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  clearScreen: false,
  resolve: {
    alias: {
      '@/': `${resolve(__dirname, 'src')}/`,
    },
    process: "process/browser",
    stream: "stream-browserify",
    zlib: "browserfiy-zlib",
    os: "os-browserify/browser",
    http: "stream-http",
    assert: "assert"
  },
  envPrefix: ['VITE_', 'TAURI_', 'VERCEL_'],
  build: {
    target: 'es2020',
    // optimizeDeps: {
    //   esbuildOptions: {
    //     target: 'es2022',
    //   },
    // },
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      plugins: [
        // inject({ Buffer: ['buffer', 'Buffer'] }),
        nodePolyfills(),
        splitVendorChunkPlugin(),
      ],
      output: {
        manualChunks: {
          vendor: libraries,
          'wagmi-vendor': ['wagmi', 'viem'],
          // ...renderChunks(dependencies),
        },
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    outDir: 'build',
  },
  optimizeDeps: {
    exclude: [],
    esbuildOptions: {
      define: {
        'global': "window",
        // __APP_ENV__: process.env.VITE_VERCEL_ENV,
      },
      plugins: [
        // NodeGlobalsPolyfillPlugin({
        //   process: true,
        //   buffer: true,
        //   global: true,
        // }),
      ]
    }
  },
})
