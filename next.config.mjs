import { withSentryConfig } from '@sentry/nextjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  // productionBrowserSourceMaps: true,
  swcMinify: false,
  experimental: {
    // The instrumentation hook is required for Sentry to work on the serverside
    instrumentationHook: true,
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
        hostname: "*",
        protocol: "http",
      },
      {
        hostname: "*",
        protocol: "https",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/demo',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/',
        destination: '/login',
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig,
  {
    silent: true,
    org: "herocast-xyz",
    project: "herocast",
  }, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
  // Hides source maps from generated client bundles
  hideSourceMaps: true,

});
