/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';
import path from 'path'; // Ensure you import path
import { fileURLToPath } from 'url';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextConfig = {
  // Include WASM files in serverless bundle for Vercel deployment
  // See: https://vercel.com/docs/functions/runtimes/wasm
  outputFileTracingIncludes: {
    '/api/embeds/metadata': ['./node_modules/@officialunofficial/trek/*.wasm'],
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    cpus: 12,
    // Optimize imports for packages that aren't auto-optimized
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-switch',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-toggle',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-collapsible',
      '@radix-ui/themes',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
    ],
  },
  // Limit ESLint to specific directories for faster builds
  eslint: {
    dirs: ['src', 'app', 'pages'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@faker-js/faker': path.resolve(__dirname, 'node_modules/@faker-js/faker'),
      '@farcaster/core': path.resolve(__dirname, 'node_modules/@farcaster/core'),
      // Router compatibility: redirect all next/router imports to our compatibility module
      'next/router': path.resolve(__dirname, 'app/router-compat-full.ts'),
    };
    return config;
  },
  // output: 'export', // Outputs a Single-Page Application (SPA).
  // distDir: './dist', // Changes the build output directory to `./dist/`.
  transpilePackages: ['react-tweet'], // https://react-tweet.vercel.app/next,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 60, // 60 days
    remotePatterns: [
      {
        hostname: '*',
        protocol: 'http',
      },
      {
        hostname: '*',
        protocol: 'https',
      },
    ],
  },
  // SWC compiler optimizations
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/login',
        permanent: false,
      },
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/01978dbe-43fa-10d9-ebbf-255c27d14cbc',
        permanent: false,
      },
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/search',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/api/additionalProfileInfo',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=43200',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: 'herocast-xyz',
    project: 'herocast',
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    // Disabled - IE11 not needed, saves build time
    transpileClientSDK: false,

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
