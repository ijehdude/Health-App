import type { Metadata, Viewport } from 'next';
import Navigation from '@/components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NutriCoach — AI Nutrition & Fitness Coach', template: '%s · NutriCoach' },
  description:
    'Log meals with a photo or text, get a full AI nutrient breakdown against your personal targets, and receive food and workout recommendations.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="min-h-screen pb-24 md:pb-8 md:pl-16">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
