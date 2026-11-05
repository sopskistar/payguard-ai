import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: [
    '@mysten-incubation/memwal',
    'pdf-parse',
    '@electric-sql/pglite',
    'tesseract.js',
    'tesseract.js-core',
    '@tesseract.js-data/eng',
    'sharp',
  ],
  outputFileTracingIncludes: {
    '/api/*': [
      './node_modules/tesseract.js/src/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/@tesseract.js-data/eng/4.0.0/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://fullnode.testnet.sui.io https://fullnode.mainnet.sui.io https://api.slush.app; worker-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
