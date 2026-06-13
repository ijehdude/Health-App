import type { Metadata, Viewport } from 'next';
import AuthGate from '@/components/AuthGate';
import Navigation from '@/components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Health Coach — AI Nutrition & Fitness', template: '%s · Health Coach' },
  description:
    'Your AI nutrition and fitness coach: log meals and workouts, track nutrients and training, get an eat-back calorie target, and follow a personalised race plan.',
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
        <AuthGate>
          <Navigation />
          <main className="min-h-screen pb-24 md:pb-8 md:pl-16">
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">{children}</div>
          </main>
        </AuthGate>
      </body>
    </html>
  );
}
