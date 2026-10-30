import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PayGuard Verify',
    short_name: 'PayGuard',
    description: 'The payment guardian that remembers.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#07121F',
    theme_color: '#07121F',
    icons: [{ src: '/brand/icon.png', sizes: '1254x1254', type: 'image/png' }],
  };
}
