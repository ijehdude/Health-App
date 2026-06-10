'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Camera, Dumbbell, Flame, Loader2 } from 'lucide-react';
import { CalorieRing, MacroRing } from '@/components/Rings';
import { useFoodLogs } from '@/hooks/useFoodLogs';
import { useProfile } from '@/hooks/useProfile';
import { analyzeGaps, recommendFoods } from '@/lib/nutrition';
import { MICRO_KEYS, type NutrientGap } from '@/lib/types';
import { cn, fmt } from '@/lib/utils';

const STATUS_PILL: Record<NutrientGap['status'], string> = {
  optimal: 'pill-green',
  deficient: 'pill-amber',
  excess: 'pill-red',
};

const STATUS_BAR: Record<NutrientGap['status'], string> = {
  optimal: 'bg-success-500',
  deficient: 'bg-warning-500',
  excess: 'bg-danger-500',
};

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const { total, streak, loading: logsLoading } = useFoodLogs();

  const gaps = useMemo(
    () => (profile ? analyzeGaps(total, profile.targets.nutrients) : []),
    [profile, total]
  );
  const recs = useMemo(
    () => (profile ? recommendFoods(gaps, profile.dietaryRestrictions) : { eatMore: [], cutDown: [] }),
    [gaps, profile]
  );

  if (profileLoading || logsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!profile) {
    router.replace('/onboarding');
    return null;
  }

  const t = profile.targets.nutrients;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const gapBy = (key: string) => gaps.find((g) => g.key === key)!;
  const microGaps = gaps.filter((g) => (MICRO_KEYS as readonly string[]).includes(g.key));
  const macroGaps = gaps.filter((g) => !(MICRO_KEYS as readonly string[]).includes(g.key));

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {profile.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400">{today}</p>
        </div>
        {streak > 0 && (
          <span className="pill bg-orange-100 text-orange-700">
            <Flame size={14} className="fill-orange-500 text-orange-500" />
            {streak}-day streak
          </span>
        )}
      </header>

      {/* Calorie + macro rings */}
      <section className="card flex flex-col items-center gap-6">
        <CalorieRing consumed={total.calories} target={t.calories} />
        <div className="grid w-full grid-cols-4 gap-2">
          <MacroRing label="Protein" consumed={total.protein} target={t.protein} unit="g" color="#16a34a" />
          <MacroRing label="Carbs" consumed={total.carbs} target={t.carbs} unit="g" color="#f59e0b" />
          <MacroRing label="Fat" consumed={total.fat} target={t.fat} unit="g" color="#9333ea" />
          <MacroRing label="Fibre" consumed={total.fibre} target={t.fibre} unit="g" color="#0d9488" />
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <Link href="/log" className="btn-primary py-3.5">
          <Camera size={18} /> Log Food
        </Link>
        <Link href="/workout" className="btn-secondary py-3.5">
          <Dumbbell size={18} /> Today&apos;s Workout
        </Link>
      </section>

      {/* Recommendations */}
      {(recs.eatMore.length > 0 || recs.cutDown.length > 0) && total.calories > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Recommendations</h2>
          {recs.eatMore.map((r) => (
            <div key={r.key} className="rounded-xl bg-success-50 px-4 py-3 text-sm">
              <span className="font-semibold text-success-700">Eat more {r.label.toLowerCase()}</span>
              <span className="text-success-700"> → try: {r.foods.join(', ')}</span>
            </div>
          ))}
          {recs.cutDown.map((r) => (
            <div key={r.key} className="rounded-xl bg-danger-50 px-4 py-3 text-sm">
              <span className="font-semibold text-danger-700">Cut down on {r.label.toLowerCase()}</span>
              <span className="text-danger-700"> — {r.advice}</span>
            </div>
          ))}
        </section>
      )}

      {/* Nutrient gaps */}
      <section className="card">
        <h2 className="mb-4 font-semibold text-slate-900">Today&apos;s nutrients</h2>
        {total.calories === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nothing logged yet today.{' '}
            <Link href="/log" className="font-semibold text-primary-600">
              Log your first meal
            </Link>{' '}
            to see your breakdown.
          </p>
        ) : (
          <div className="space-y-4">
            <NutrientGapList gaps={macroGaps} />
            <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Vitamins & minerals
            </h3>
            <NutrientGapList gaps={microGaps} />
          </div>
        )}
      </section>
    </div>
  );

  function NutrientGapList({ gaps: list }: { gaps: NutrientGap[] }) {
    return (
      <div className="space-y-3">
        {list.map((g) => (
          <div key={g.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">{g.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-slate-400">
                  {fmt(g.consumed)}/{fmt(g.target)} {g.unit}
                </span>
                <span className={cn(STATUS_PILL[g.status])}>{g.statusLabel}</span>
              </div>
            </div>
            <div className="progress-track">
              <div
                className={cn('progress-fill', STATUS_BAR[g.status])}
                style={{ width: `${Math.min(g.percent, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
}
