'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, Clock, Info, Loader2, RefreshCw } from 'lucide-react';
import ExerciseSVG from '@/components/ExerciseSVG';
import { useFoodLogs } from '@/hooks/useFoodLogs';
import { useProfile } from '@/hooks/useProfile';
import { ageGroupOf } from '@/lib/nutrition';
import { generateWorkoutPlan } from '@/lib/workout';
import { AGE_GROUP_LABELS, type Exercise, type Intensity, type WorkoutPlan } from '@/lib/types';
import { cn } from '@/lib/utils';

const INTENSITY_PILL: Record<Intensity, string> = {
  light: 'pill-green',
  moderate: 'pill-amber',
  vigorous: 'pill-red',
};

const EQUIPMENT_LABEL: Record<Exercise['equipment'], string> = {
  none: 'No equipment',
  minimal: 'Minimal equipment',
  gym: 'Gym equipment',
};

export default function WorkoutPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { total, loading: logsLoading } = useFoodLogs();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    if (profile && !logsLoading) setPlan(generateWorkoutPlan(profile, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, logsLoading]);

  if (profileLoading || logsLoading || (profile && !plan)) {
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
          Set up your profile first to get a personalised workout.
        </p>
        <Link href="/onboarding" className="btn-primary mt-4">
          Start onboarding
        </Link>
      </div>
    );
  }

  if (!plan) return null;
  const ageGroup = ageGroupOf(profile.age);

  const refresh = () => {
    setExpanded(null);
    setShowAlternatives(false);
    setPlan(generateWorkoutPlan(profile, total));
  };

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Today&apos;s Workout</h1>
          <p className="text-sm text-slate-400">Built from today&apos;s nutrition and your profile.</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={refresh}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {/* Plan summary */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-primary-100 text-primary-700">{plan.reason}</span>
          <span className={INTENSITY_PILL[plan.intensity]}>{plan.intensity} intensity</span>
          <span className="pill bg-slate-100 text-slate-600">
            <Clock size={12} /> ~{plan.totalDurationMinutes} min
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{plan.rationale}</p>
      </section>

      {/* Age-group banner */}
      {plan.ageGroupNote && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>{plan.ageGroupNote}</p>
        </div>
      )}

      {/* Exercise cards */}
      <section className="space-y-3">
        {plan.exercises.map((ex) => {
          const isOpen = expanded === ex.id;
          const modification = ex.modifications[ageGroup];
          return (
            <div key={ex.id} className="card p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : ex.id)}
                className="flex w-full items-center gap-4 p-4 text-left"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                  <ExerciseSVG svgKey={ex.svgKey} type={ex.type} size={64} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{ex.name}</h3>
                  <p className="text-sm text-slate-500">
                    {ex.sets ? `${ex.sets} sets × ${ex.reps}` : `${ex.durationMinutes} minutes`}
                  </p>
                  <p className="truncate text-xs text-slate-400">{ex.muscles.join(' · ')}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={INTENSITY_PILL[ex.intensity]}>{ex.intensity}</span>
                  <ChevronDown
                    size={18}
                    className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="animate-slide-up space-y-3 border-t border-slate-100 px-4 py-4 text-sm">
                  <p className="leading-relaxed text-slate-600">{ex.description}</p>
                  {modification && (
                    <div className="rounded-xl bg-warning-50 px-4 py-3 text-warning-800">
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        {AGE_GROUP_LABELS[ageGroup]} modification
                      </p>
                      <p className="mt-1">{modification}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className="pill bg-slate-100 text-slate-600">
                      {EQUIPMENT_LABEL[ex.equipment]}
                    </span>
                    <span className="pill bg-slate-100 text-slate-600 capitalize">{ex.type}</span>
                    <span className="pill bg-slate-100 text-slate-600">
                      ~{ex.durationMinutes} min
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Alternatives */}
      {plan.alternatives.length > 0 && (
        <section className="card p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAlternatives((s) => !s)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="font-semibold text-slate-900">
              Alternatives <span className="font-normal text-slate-400">— swap any exercise</span>
            </span>
            <ChevronDown
              size={18}
              className={cn('text-slate-400 transition-transform', showAlternatives && 'rotate-180')}
            />
          </button>
          {showAlternatives && (
            <div className="animate-slide-up space-y-2 border-t border-slate-100 px-4 py-4">
              {plan.alternatives.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <ExerciseSVG svgKey={ex.svgKey} type={ex.type} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{ex.name}</p>
                    <p className="text-xs text-slate-400">
                      {ex.sets ? `${ex.sets} × ${ex.reps}` : `${ex.durationMinutes} min`}
                    </p>
                  </div>
                  <span className={INTENSITY_PILL[ex.intensity]}>{ex.intensity}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
