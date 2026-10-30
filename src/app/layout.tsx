import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import './marketing.css';
import './journey.css';
import './release.css';
export const metadata: Metadata = {
  title: {
    default: 'PayGuard Verify | Verify supplier payment instructions',
    template: '%s | PayGuard Verify',
  },
  description:
    'Verify supplier payment-instruction changes with established contacts, Walrus policy recall and Tatum Sui Mainnet evidence.',
  icons: { icon: '/brand/icon.png?v=c2c6ba8', apple: '/brand/icon.png?v=c2c6ba8' },
  manifest: '/manifest.webmanifest',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
