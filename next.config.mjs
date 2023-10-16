/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export', // Outputs a Single-Page Application (SPA).
    distDir: './dist', // Changes the build output directory to `./dist/`.
    transpilePackages: ['react-tweet'], // https://react-tweet.vercel.app/next
  }
   
  export default nextConfig