'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Activity, CalendarRange, Dumbbell, Loader2, MessageCircle } from 'lucide-react';
import Coach from '@/components/workout/Coach';
import LogExercise from '@/components/workout/LogExercise';
import RacePlan from '@/components/workout/RacePlan';
import TodayWorkout from '@/components/workout/TodayWorkout';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';

type Tab = 'today' | 'log' | 'race' | 'coach';

const TABS: { value: Tab; label: string; icon: typeof Dumbbell }[] = [
  { value: 'today', label: 'Today', icon: Dumbbell },
  { value: 'log', label: 'Log', icon: Activity },
  { value: 'race', label: 'Race plan', icon: CalendarRange },
  { value: 'coach', label: 'Coach', icon: MessageCircle },
];

export default function WorkoutPage() {
  const { profile, loading } = useProfile();
  const [tab, setTab] = useState<Tab>('today');

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card mt-10 text-center">
        <p className="text-sm text-slate-500">
          Set up your profile first to get personalised training.
        </p>
        <Link href="/onboarding" className="btn-primary mt-4">
          Start onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Fitness</h1>
        <p className="text-sm text-slate-400">
          Your workout, exercise log, race plan and coach — all in one place.
        </p>
      </header>

      {/* Sub-tabs */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors sm:text-sm',
              tab === value ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'today' && <TodayWorkout profile={profile} />}
      {tab === 'log' && <LogExercise profile={profile} />}
      {tab === 'race' && <RacePlan profile={profile} />}
      {tab === 'coach' && <Coach profile={profile} />}
    </div>
  );
}
