'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Camera, Dumbbell, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log', label: 'Log Food', icon: Camera },
  { href: '/history', label: 'History', icon: BarChart3 },
  { href: '/workout', label: 'Fitness', icon: Dumbbell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  if (pathname === '/onboarding') return null;

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-slate-200 bg-white py-4 md:flex">
        <Link
          href="/"
          aria-label="Health Coach home"
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg font-black text-white"
        >
          H
        </Link>
        <nav className="flex flex-col gap-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: fixed bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[10px] font-medium',
                active ? 'text-primary-600' : 'text-slate-400'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
