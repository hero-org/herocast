import million from 'million/compiler';

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
}

const millionConfig = {
  auto: {
    threshold: 0.05, // default: 0.1,
    skip: ['AccountsRightSidebar', 'EmbedsModal', /Modal/g, 'ConnectModal', 'ConnectButton', 'NounsBuildEmbed'], // default []
    rsc: true,
  }
}

export default million.next(nextConfig, millionConfig);

// export default nextConfig