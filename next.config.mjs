import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Empty turbopack config silences the "webpack config without turbopack config" error.
  // Serwist's service worker generation runs via webpack plugin at build time;
  // the turbopack pass simply ignores it.
  turbopack: {},
}

export default withSerwist(nextConfig)
