import type { Metadata } from 'next';
import { Fredoka, Manrope } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nyx.gg'),
  title: 'Nyx — Wake the God of Sleep',
  description: 'He wakes when the circle proves itself — one wallet, one post, one dream at a time.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Nyx — Wake the God of Sleep',
    description: 'He wakes when the circle proves itself — one wallet, one post, one dream at a time.',
    images: [{ url: '/main.webp', width: 1600, height: 900, alt: 'Nyx, the God of Sleep dreaming on clouds beneath the moon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nyx — Wake the God of Sleep',
    description: 'He wakes when the circle proves itself — one wallet, one post, one dream at a time.',
    images: ['/main.webp'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
