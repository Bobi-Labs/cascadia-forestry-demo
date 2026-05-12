import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The demo serves under bobilabs.dev/forestry-demo via a path rewrite
  // in bobilabs-dev/vercel.json. Without basePath the browser would
  // request /_next/static/... from bobilabs.dev (which doesn't host the
  // demo's assets) and the page renders unstyled. Mirrors the
  // /worktracker pattern in bobi-worktracker.
  basePath: '/forestry-demo',
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
