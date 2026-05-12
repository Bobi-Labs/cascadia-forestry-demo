import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cascadia Ops — Forestry Operations',
    short_name: 'Cascadia Ops',
    description: 'Forestry operations management for Cascadia Forestry Inc and Ramos Reforestation Inc',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0f1a',
    theme_color: '#0a0f1a',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
