import type { Metadata } from 'next';
import { Space_Grotesk, Syne } from 'next/font/google';
import './global.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const space = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'CricInsights Chat',
  description: 'Glassy generative UI cricket chatbot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${space.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
