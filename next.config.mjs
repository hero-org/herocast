/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';
import path from 'path'; // Ensure you import path
import { fileURLToPath } from 'url';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@faker-js/faker': path.resolve(__dirname, 'node_modules/@faker-js/faker'),
      '@farcaster/core': path.resolve(__dirname, 'node_modules/@farcaster/core'),
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
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/login',
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
    transpileClientSDK: true,

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
