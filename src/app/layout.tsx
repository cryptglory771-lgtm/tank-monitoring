import type { Metadata, Viewport } from 'next';
import './globals.css';
import Bootstrap from '@/components/Bootstrap';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Cooling Tank Monitor',
  description: 'Pantau suhu tanki pendingin susu secara langsung.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Cooling Tank' },
};

export const viewport: Viewport = {
  themeColor: '#0A0E13',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Bootstrap />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
