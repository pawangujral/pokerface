import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planning Poker — Free Online Scrum Estimation Tool | No Ads, No Sign-up',
  description:
    'Free online planning poker tool for agile teams. Estimate story points together in real-time. No ads, no sign-up required — just create a session and start estimating.',
  keywords: 'planning poker, scrum poker, story point estimation, agile estimation, free planning poker',
  authors: [{ name: 'PokerFace' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: 'Planning Poker — Free Online Estimation Tool',
    description: 'Estimate story points together in real-time. Free, no ads, no sign-up required.',
    url: 'https://pawangujral.github.io/pokerface/',
    siteName: 'PokerFace',
  },
  twitter: {
    card: 'summary',
    title: 'Planning Poker — Free Online Estimation Tool',
    description: 'Estimate story points together in real-time. Free, no ads, no sign-up required.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
